"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FEEDBACK_CATEGORIES, FEEDBACK_LABEL, FEEDBACK_MAX_CHARS, FEEDBACK_MIN_CHARS, type Announcement, type FeedbackCategory } from "@/domain/community";
import { landingCommunity, localSaveSummary } from "@/composition/client";
import { art } from "./art";

const noop = () => () => {};
let cachedSave: ReturnType<typeof localSaveSummary> | undefined;
const readSave = () => (cachedSave === undefined ? (cachedSave = localSaveSummary()) : cachedSave);

/** Local save summary; null on the server and when this device has no save. */
function useLocalSave() {
  return useSyncExternalStore(noop, readSave, () => null);
}

/** "Chơi ngay", or "Chơi tiếp · Ngày N" when this browser already has a save. */
export function PlayButton({ className = "" }: { className?: string }) {
  const save = useLocalSave();
  return (
    <Link href="/play" prefetch={false} className={`btn ${save ? "btn-green" : ""} ${className}`} data-testid="play-cta">
      {save ? `Chơi tiếp · Ngày ${save.day}` : "Chơi ngay"}
    </Link>
  );
}

const MOODS = ["idle", "happy", "impatient", "sad"] as const;
const MOOD_LABEL: Record<(typeof MOODS)[number], string> = { idle: "bình thường", happy: "vui", impatient: "sốt ruột", sad: "buồn" };

/** Cat portrait that cycles through its moods when tapped. */
export function MoodPortrait({ base, name }: { base: string; name: string }) {
  const [i, setI] = useState(0);
  const mood = MOODS[i];
  return (
    <button
      type="button"
      className="group relative flex h-full w-full items-end justify-center"
      onClick={() => setI((i + 1) % MOODS.length)}
      aria-label={`${name}: đang ${MOOD_LABEL[mood]}. Chạm để đổi biểu cảm`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={mood}
        src={art(`${base}_${mood}`)}
        alt=""
        draggable={false}
        loading="lazy"
        className="pop-in h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_6px_0_rgba(74,44,29,0.18)] transition-transform group-hover:-translate-y-1"
      />
    </button>
  );
}

const TONE_STYLE = {
  info: "border-bean bg-paper",
  event: "border-matcha bg-[#e3f4dc]",
  warning: "border-berry bg-[#fdf0ee]",
} as const;
const TONE_LABEL = { info: "Thông báo", event: "Sự kiện", warning: "Lưu ý" } as const;

/** The live announcement from the admin page. Renders nothing when there is none. */
export function LatestAnnouncement() {
  const [a, setA] = useState<Announcement | null>(null);
  useEffect(() => {
    let alive = true;
    void landingCommunity.announcement().then((v) => alive && setA(v));
    return () => {
      alive = false;
    };
  }, []);
  if (!a) return null;
  return (
    <section aria-labelledby="news-title" className="mx-auto w-full max-w-3xl px-5 pt-14">
      <div className={`pop-in rounded-3xl border-4 px-6 py-5 shadow-[0_6px_0_rgba(74,44,29,0.45)] ${TONE_STYLE[a.tone]}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="news-title" className="text-xl font-extrabold">
            {TONE_LABEL[a.tone]} mới nhất
          </h2>
          <time className="text-sm font-bold text-cocoa" dateTime={new Date(a.createdAt).toISOString()}>
            {new Date(a.createdAt).toLocaleDateString("vi-VN")}
          </time>
        </div>
        <p className="whitespace-pre-line text-lg font-semibold">{a.text}</p>
      </div>
    </section>
  );
}

/** Feedback form posting to the same API as the in-game form. */
export function FeedbackForm() {
  const save = useLocalSave();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [state, setState] = useState<{ busy: boolean; result: { ok: boolean; text: string } | null }>({ busy: false, result: null });
  const text = message.trim();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (state.busy || text.length < FEEDBACK_MIN_CHARS) return;
        setState({ busy: true, result: null });
        const r = await landingCommunity.sendFeedback({
          category,
          message: text,
          rating,
          context: { day: save?.day ?? 0, money: save?.money ?? 0, reputation: save?.reputation ?? 0, phase: "landing", screen: "landing" },
        });
        setState({ busy: false, result: r.ok ? { ok: true, text: "Cảm ơn bạn đã góp ý! Nhà phát triển sẽ đọc sớm." } : { ok: false, text: r.message } });
        if (r.ok) {
          setMessage("");
          setRating(null);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Loại góp ý">
        {FEEDBACK_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            className={`chip justify-center ${category === c ? "!bg-caramel text-white" : ""}`}
            onClick={() => setCategory(c)}
          >
            {FEEDBACK_LABEL[c]}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1">
        <span className="font-bold">Nội dung</span>
        <textarea
          name="message"
          className="min-h-[8em] rounded-2xl border-[3px] border-bean bg-white px-4 py-3 text-base"
          maxLength={FEEDBACK_MAX_CHARS}
          value={message}
          placeholder="Ví dụ: mình muốn có thêm món trà đào..."
          onChange={(e) => setMessage(e.target.value)}
        />
        <span className="self-end text-sm text-cocoa tabular-nums">
          {message.length}/{FEEDBACK_MAX_CHARS}
        </span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold">Chấm điểm game (tùy chọn)</span>
        <span className="inline-flex" role="radiogroup" aria-label="Số sao">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`} className="p-1" onClick={() => setRating(rating === n ? null : n)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art("star")} alt="" className={`h-8 w-8 object-contain ${rating !== null && n <= rating ? "" : "opacity-35 grayscale"}`} />
            </button>
          ))}
        </span>
      </div>
      <button className="btn btn-green text-lg" disabled={state.busy || text.length < FEEDBACK_MIN_CHARS}>
        {state.busy ? "Đang gửi..." : "Gửi góp ý"}
      </button>
      <p aria-live="polite" className={`min-h-[1.5em] text-center font-bold ${state.result?.ok ? "text-[#3f8a43]" : "text-berry"}`}>
        {state.result?.text}
      </p>
    </form>
  );
}
