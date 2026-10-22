/**
 * Tiny procedural audio (WebAudio) so the game ships without audio files.
 * Unlocked on first user gesture.
 */
type Sfx = "click" | "pour" | "plop" | "ice" | "seal" | "coin" | "happy" | "sad" | "bell" | "error" | "pump";

class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  musicVolume = 0.5;
  sfxVolume = 0.8;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
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
    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.12, this.ctx.currentTime, 0.1);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume * 0.5, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, dest?: GainNode, slideTo?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest ?? this.sfxGain!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, freq: number) {
    if (!this.ctx || !this.sfxGain) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.sfxGain);
    src.start();
  }

  play(name: Sfx) {
    if (!this.ctx || this.sfxVolume <= 0) return;
    switch (name) {
      case "click":
        this.tone(880, 0.06, "triangle", 0.3);
        break;
      case "pump":
        this.tone(320, 0.12, "sine", 0.4, 0, undefined, 160);
        break;
      case "pour":
        this.noise(0.18, 0.35, 900);
        break;
      case "plop":
        this.tone(520, 0.1, "sine", 0.5, 0, undefined, 260);
        this.tone(700, 0.08, "sine", 0.3, 0.06, undefined, 350);
        break;
      case "ice":
        this.tone(2400, 0.05, "triangle", 0.25);
        this.tone(3100, 0.05, "triangle", 0.2, 0.05);
        this.tone(2700, 0.05, "triangle", 0.2, 0.1);
        break;
      case "seal":
        this.noise(0.25, 0.4, 300);
        this.tone(200, 0.2, "square", 0.08);
        break;
      case "coin":
        this.tone(988, 0.08, "square", 0.15);
        this.tone(1319, 0.2, "square", 0.15, 0.08);
        break;
      case "happy":
        [660, 830, 990].forEach((f, i) => this.tone(f, 0.14, "triangle", 0.3, i * 0.08));
        break;
      case "sad":
        this.tone(440, 0.3, "sine", 0.3, 0, undefined, 300);
        break;
      case "bell":
        this.tone(1568, 0.6, "sine", 0.3);
        this.tone(2093, 0.5, "sine", 0.15, 0.02);
        break;
      case "error":
        this.tone(180, 0.15, "square", 0.15);
        break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Gentle pentatonic loop.
    const chords = [
      [261.6, 329.6, 392],
      [220, 261.6, 329.6],
      [174.6, 220, 261.6],
      [196, 246.9, 293.7],
    ];
    const melody = [523, 587, 659, 784, 659, 587, 523, 440, 523, 659, 784, 880, 784, 659, 587, 523];
    const beat = 0.42;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== "running" || this.musicVolume <= 0) {
        this.step++;
        return;
      }
      const s = this.step++;
      if (s % 4 === 0) for (const f of chords[(s / 4) % chords.length]) this.tone(f, beat * 4, "sine", 0.18, 0, this.musicGain!);
      if (s % 2 === 0 || Math.random() < 0.4) this.tone(melody[s % melody.length], beat * 0.9, "triangle", 0.12, 0, this.musicGain!);
    }, beat * 1000);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new AudioManager();
