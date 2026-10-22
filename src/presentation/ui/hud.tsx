"use client";

import { DAY } from "@/domain/catalog";
import { audio } from "../game/audio";
import { DayStatus, RatingChip } from "./features";
import { Coin } from "./kit";
import { useGame } from "./useGame";
import { pctX, pctY, useLayout } from "./useLayout";

function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.floor(((hour - h) * 60) / 10) * 10;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function Hud() {
  const game = useGame();
  const L = useLayout();
  const s = game.save;
  const session = game.session;
  const progress = session.clock / DAY.lengthSec;
  const open = game.phase === "open";
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 flex flex-col gap-[0.4em] p-[1.2em]" style={{ width: pctX(L, L.room.w) }}>
      <div className="flex items-center gap-[0.4em]">
        <span className="chip pointer-events-auto !cursor-default">
          <Coin value={s.money} />
        </span>
        <RatingChip />
        <span className="chip pointer-events-auto !cursor-default flex-1 justify-center tabular-nums" aria-live="off">
          Ngày {s.day} · {open ? (session.closing ? "Đóng cửa" : formatHour(session.hour)) : "Chuẩn bị"}
        </span>
        {open && (
          <button className="chip pointer-events-auto" onClick={() => game.openModal("pause")} aria-label="Tạm dừng">
            ❚❚
          </button>
        )}
      </div>
      {open && (
        <div className="h-[0.45em] overflow-hidden rounded-full border-2 border-bean bg-[rgba(255,250,242,0.85)]">
          <div className="h-full bg-caramel" style={{ width: `${Math.min(1, progress) * 100}%` }} />
        </div>
      )}
      <DayStatus />
    </div>
  );
}

export function HintBar() {
  const game = useGame();
  const L = useLayout();
  const hint = game.session.hint;
  if (game.phase !== "open" || game.save.tutorialDone || !game.save.settings.hints || !hint?.text) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 flex -translate-y-1/2 justify-center"
      style={{ left: pctX(L, L.hint.x), width: pctX(L, L.hint.w), top: pctY(L, L.hint.y) }}
    >
      <div key={hint.step} className="panel pop-in flex items-center gap-2 !rounded-2xl !border-[3px] px-[0.8em] py-[0.4em] text-[0.95em] font-bold">
        {hint.step > 0 && (
          <span className="shrink-0 rounded-full bg-caramel px-[0.5em] text-white">
            {hint.step}/{hint.total}
          </span>
        )}
        <span>{hint.text}</span>
      </div>
    </div>
  );
}

export function Toasts() {
  const game = useGame();
  const L = useLayout();
  const color = { info: "bg-paper", good: "bg-[#e3f4dc]", bad: "bg-[#fde2dc]" } as const;
  return (
    <div
      className="pointer-events-none absolute top-[4.5em] z-50 flex flex-col items-center gap-[0.35em] px-[1em]"
      style={{ left: 0, width: L.kind === "landscape" ? pctX(L, L.room.w) : "100%" }}
      role="status"
      aria-live="polite"
    >
      {game.notices.items.map((n) => (
        <button
          key={n.id}
          className={`pointer-events-auto pop-in rounded-2xl border-[3px] border-bean px-[0.9em] py-[0.3em] text-center text-[0.95em] font-bold shadow-[0_3px_0_var(--bean)] ${color[n.kind]}`}
          onClick={() => game.notices.dismiss(n.id)}
        >
          {n.text}
        </button>
      ))}
    </div>
  );
}

/** Starts background music on the first gesture anywhere (browsers block autoplay). */
export function unlockAudioOnce() {
  const go = () => {
    audio.unlock();
    audio.startMusic();
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
  };
  window.addEventListener("pointerdown", go);
  window.addEventListener("keydown", go);
  return () => {
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
  };
}
