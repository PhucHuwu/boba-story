/**
 * Procedural audio (WebAudio) so the game ships without audio files.
 * Music is scheduled ahead on the audio clock (no setInterval jitter); SFX go through a shared bus with a
 * soft compressor so loud layers never clip. Unlocked on first user gesture.
 */
export type Sfx =
  | "click"
  | "pour"
  | "plop"
  | "ice"
  | "seal"
  | "coin"
  | "happy"
  | "sad"
  | "bell"
  | "error"
  | "pump"
  | "star"
  | "ting"
  | "bad"
  | "alarm"
  | "crash"
  | "trash"
  | "sweep"
  | "fanfare"
  | "event";

export type MusicMood = "day" | "night" | "tense";

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

interface Song {
  bpm: number;
  /** Chords as MIDI notes; one per bar. */
  chords: number[][];
  bass: number[];
  /** Melody per 8th note (null = rest), loops over all bars. */
  melody: (number | null)[];
  drums: boolean;
  keysWave: OscillatorType;
}

const SONGS: Record<MusicMood, Song> = {
  // Cozy lo-fi: Fmaj7 – Em7 – Dm7 – Cmaj7(add9)
  day: {
    bpm: 84,
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 55, 59, 62],
    ],
    bass: [41, 40, 38, 36],
    melody: [
      72, null, 76, null, 79, 77, 76, null,
      74, null, 76, 74, 71, null, null, null,
      72, null, 74, null, 77, null, 76, 74,
      72, null, 71, 72, 67, null, null, null,
    ],
    drums: true,
    keysWave: "triangle",
  },
  // Sleepy music box for the night phase.
  night: {
    bpm: 66,
    chords: [
      [45, 52, 57, 60],
      [41, 48, 53, 57],
      [43, 50, 55, 59],
      [40, 47, 52, 56],
    ],
    bass: [33, 29, 31, 28],
    melody: [
      81, null, null, 76, null, null, 79, null,
      77, null, null, 72, null, null, 74, null,
      76, null, null, 71, null, null, 72, null,
      71, null, 68, null, null, null, null, null,
    ],
    drums: false,
    keysWave: "sine",
  },
  // Sneaky staccato for rival events.
  tense: {
    bpm: 112,
    chords: [
      [45, 48, 52],
      [45, 48, 52],
      [46, 50, 53],
      [44, 47, 52],
    ],
    bass: [33, 33, 34, 32],
    melody: [
      69, null, 72, null, 69, null, 68, null,
      69, null, 72, 74, 75, null, 74, null,
      69, null, 72, null, 69, null, 65, null,
      64, null, 68, null, 71, null, null, null,
    ],
    drums: true,
    keysWave: "square",
  },
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteAt = 0;
  private step = 0;
  private mood: MusicMood = "day";
  private pourNodes: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private bubbleTimer: ReturnType<typeof setInterval> | null = null;
  private fill = 0;
  musicVolume = 0.5;
  sfxVolume = 0.8;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp).connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    // Perceptual curve: slider² keeps the low end usable.
    this.musicGain.gain.setTargetAtTime(this.musicVolume * this.musicVolume * 0.9, this.ctx.currentTime, 0.1);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume * this.sfxVolume * 0.9, this.ctx.currentTime, 0.02);
  }

  // ------------------------------------------------------------- primitives
  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, dest?: AudioNode, slideTo?: number, attack = 0.008) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, when);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest ?? this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Filtered noise burst. `at` is an absolute audio time (0 = now). */
  private noise(dur: number, gain: number, freq: number, type: BiquadFilterType = "bandpass", q = 1, dest?: AudioNode, at = 0, sweepTo?: number) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = at || this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest ?? this.sfxGain!);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** A single liquid "bloop": a sine whose pitch rises quickly, like an air bubble. */
  private bubble(base: number, gain: number, at = 0) {
    if (!this.ctx) return;
    const t = at || this.ctx.currentTime;
    const dur = 0.04 + Math.random() * 0.05;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * (1.8 + Math.random() * 0.8), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------- pouring (continuous)
  /** Starts a looping liquid stream. `fill` (0..1) raises the pitch as the cup fills, like real pouring. */
  startPour(fill = 0) {
    if (!this.ctx || !this.noiseBuf || this.pourNodes || this.sfxVolume <= 0) return;
    const t = this.ctx.currentTime;
    this.fill = fill;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.2;
    filter.frequency.value = 500 + fill * 900;
    // Wobble the band so it "flows" instead of hissing.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 7;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    const low = this.ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 2600;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.32, t + 0.08);
    src.connect(filter).connect(low).connect(gain).connect(this.sfxGain!);
    src.start(t);
    lfo.start(t);
    src.onended = () => lfo.stop();
    this.pourNodes = { src, gain, filter };
    this.bubbleTimer = setInterval(() => {
      if (Math.random() < 0.75) this.bubble(260 + this.fill * 520 + Math.random() * 120, 0.22);
    }, 55);
  }

  setPourFill(fill: number) {
    this.fill = Math.max(0, Math.min(1.2, fill));
    if (this.ctx && this.pourNodes) this.pourNodes.filter.frequency.setTargetAtTime(500 + this.fill * 900, this.ctx.currentTime, 0.1);
  }

  stopPour() {
    if (this.bubbleTimer) clearInterval(this.bubbleTimer);
    this.bubbleTimer = null;
    if (!this.ctx || !this.pourNodes) return;
    const { src, gain } = this.pourNodes;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setTargetAtTime(0.0001, t, 0.05);
    src.stop(t + 0.3);
    // Last drips.
    for (let i = 0; i < 3; i++) this.bubble(500 + this.fill * 400 + i * 60, 0.15, t + 0.08 + i * 0.09);
    this.pourNodes = null;
  }

  // ------------------------------------------------------------- one-shots
  play(name: Sfx) {
    if (!this.ctx || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case "click":
        this.tone(1200, 0.05, "sine", 0.35, 0, undefined, 800);
        this.noise(0.02, 0.15, 4000, "highpass");
        break;
      case "pump":
        // Syrup pump: soft "pfft" + squishy drop.
        this.noise(0.12, 0.35, 900, "bandpass", 1.5, undefined, 0, 400);
        this.bubble(220, 0.4, now + 0.08);
        break;
      case "pour":
        for (let i = 0; i < 6; i++) this.bubble(300 + i * 40, 0.2, now + i * 0.04);
        break;
      case "plop":
        // Topping spoonful landing in liquid.
        this.bubble(180, 0.55);
        this.bubble(260, 0.35, now + 0.07);
        this.bubble(340, 0.25, now + 0.13);
        this.noise(0.08, 0.15, 1200, "bandpass", 2);
        break;
      case "ice":
        // Cubes clinking: bright inharmonic pings at random offsets.
        for (let i = 0; i < 4; i++) {
          const at = now + i * (0.045 + Math.random() * 0.04);
          const f = 2200 + Math.random() * 1600;
          this.tone(f, 0.12, "sine", 0.22, at - now);
          this.tone(f * 2.76, 0.06, "sine", 0.08, at - now);
          this.noise(0.03, 0.18, 6000, "highpass", 1, undefined, at);
        }
        break;
      case "seal":
        // Sealer press: mechanical clunk then hot-film hiss.
        this.tone(140, 0.12, "triangle", 0.5, 0, undefined, 70);
        this.noise(0.05, 0.4, 2500, "bandpass", 2);
        this.noise(0.35, 0.18, 5000, "highpass", 0.7, undefined, now + 0.08);
        this.tone(1760, 0.08, "sine", 0.15, 0.4);
        break;
      case "coin":
        this.tone(1568, 0.09, "square", 0.12);
        this.tone(2093, 0.35, "square", 0.12, 0.08);
        this.tone(2093, 0.35, "sine", 0.2, 0.08);
        break;
      case "happy":
        [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), 0.18, "triangle", 0.3, i * 0.07));
        break;
      case "sad":
        this.tone(midi(67), 0.25, "triangle", 0.3, 0, undefined, midi(63));
        this.tone(midi(62), 0.45, "triangle", 0.3, 0.22, undefined, midi(58));
        break;
      case "bell":
        // Door chime: two bell partials, long tail.
        for (const [n, at] of [
          [88, 0],
          [84, 0.18],
        ] as const) {
          this.tone(midi(n), 1.2, "sine", 0.28, at);
          this.tone(midi(n) * 2.4, 0.4, "sine", 0.07, at);
        }
        break;
      case "error":
        this.tone(220, 0.09, "square", 0.12);
        this.tone(185, 0.14, "square", 0.12, 0.1);
        break;
      case "star":
        this.tone(midi(91), 0.25, "sine", 0.18);
        this.tone(midi(96), 0.4, "sine", 0.14, 0.06);
        break;
      case "ting":
        // Small glassy chime when a pour hits its mark.
        this.tone(midi(96), 0.18, "sine", 0.12);
        this.tone(midi(103), 0.3, "sine", 0.06, 0.04);
        break;
      case "bad":
        // Comedic "wah-wah".
        [60, 59, 58].forEach((n, i) => this.tone(midi(n), 0.28, "sawtooth", 0.09, i * 0.25, undefined, midi(n) * 0.97));
        this.tone(midi(57), 0.7, "sawtooth", 0.09, 0.75, undefined, midi(55));
        break;
      case "alarm":
        for (let i = 0; i < 6; i++) this.tone(i % 2 ? 660 : 880, 0.22, "square", 0.12, i * 0.24);
        break;
      case "crash":
        this.noise(0.6, 0.6, 3000, "highpass", 0.5);
        this.tone(90, 0.3, "triangle", 0.5, 0, undefined, 40);
        for (let i = 0; i < 5; i++) this.tone(3000 + Math.random() * 3000, 0.15, "sine", 0.08, 0.05 + i * 0.05);
        break;
      case "trash":
        // Cardboard + cans thrown on the floor.
        this.noise(0.25, 0.4, 600, "lowpass", 1);
        this.tone(1300, 0.2, "triangle", 0.12, 0.08, undefined, 1150);
        this.tone(1700, 0.15, "triangle", 0.1, 0.2, undefined, 1500);
        break;
      case "sweep":
        this.noise(0.18, 0.3, 2500, "bandpass", 1, undefined, 0, 5000);
        break;
      case "fanfare":
        [67, 72, 76, 79].forEach((n, i) => this.tone(midi(n), 0.2, "square", 0.08, i * 0.1));
        [72, 76, 79, 84].forEach((n) => this.tone(midi(n), 0.9, "triangle", 0.12, 0.42));
        break;
      case "event":
        this.tone(midi(62), 0.12, "square", 0.1);
        this.tone(midi(65), 0.12, "square", 0.1, 0.13);
        this.tone(midi(68), 0.3, "square", 0.1, 0.26);
        break;
    }
  }

  // ------------------------------------------------------------- music
  setMood(mood: MusicMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.step = 0;
  }

  startMusic(mood?: MusicMood) {
    if (mood) this.setMood(mood);
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteAt = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 50);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    if (ctx.state !== "running") {
      this.nextNoteAt = ctx.currentTime + 0.1;
      return;
    }
    // If the tab was throttled, skip ahead instead of firing a burst of notes.
    if (this.nextNoteAt < ctx.currentTime - 0.2) this.nextNoteAt = ctx.currentTime + 0.05;
    while (this.nextNoteAt < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextNoteAt);
      const song = SONGS[this.mood];
      const eighth = 30 / song.bpm;
      // Light swing on off-beats.
      this.nextNoteAt += this.step % 2 === 0 ? eighth * 1.12 : eighth * 0.88;
      this.step++;
    }
  }

  private playStep(s: number, at: number) {
    const song = SONGS[this.mood];
    // tone() takes a delay relative to now; noise() takes an absolute time.
    const t = Math.max(0, at - this.ctx!.currentTime);
    const out = this.musicGain!;
    const eighth = 30 / song.bpm;
    const bar = Math.floor(s / 8) % song.chords.length;
    const inBar = s % 8;
    if (inBar === 0) {
      // Electric-piano-ish pad: two detuned layers per note.
      for (const n of song.chords[bar]) {
        this.tone(midi(n), eighth * 7.5, song.keysWave, 0.07, t, out, undefined, 0.02);
        this.tone(midi(n) * 1.004, eighth * 7.5, "sine", 0.05, t, out, undefined, 0.02);
      }
    }
    if (inBar === 0 || inBar === 3 || inBar === 6) this.tone(midi(song.bass[bar]), eighth * 1.8, "sine", 0.32, t, out, undefined, 0.01);
    const m = song.melody[s % song.melody.length];
    if (m !== null) {
      this.tone(midi(m), eighth * 1.6, "triangle", 0.12, t, out, undefined, 0.01);
      this.tone(midi(m) * 2, eighth * 0.6, "sine", 0.03, t, out);
    }
    if (!song.drums) return;
    if (inBar === 0 || inBar === 5) this.tone(110, 0.18, "sine", 0.55, t, out, 45, 0.003);
    if (inBar === 2 || inBar === 6) this.noise(0.12, 0.16, 1800, "bandpass", 0.8, out, at);
    this.noise(0.035, inBar % 2 ? 0.05 : 0.08, 8000, "highpass", 1, out, at);
  }
}

export const audio = new AudioManager();
