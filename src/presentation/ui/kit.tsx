"use client";

import { useEffect, type ReactNode } from "react";
import { useGame } from "./useGame";

/** Image paths for UI icons (same webp assets the scene uses). */
export const asset = (key: string) => `/assets/${key}.webp`;

export function Coin({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-[0.2em] font-extrabold tabular-nums">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("coin")} alt="" className="h-[1.1em] w-[1.1em] object-contain" />
      {Math.floor(value)}
    </span>
  );
}

export function Bar({ value, color = "var(--matcha)" }: { value: number; color?: string }) {
  return (
    <div className="h-[0.55em] w-full overflow-hidden rounded-full border-2 border-bean bg-[#efe1cf]">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}

/** Centered dialog inside the game stage. ESC closes it outside of the open shop (the scene handles ESC there). */
export function Modal({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose?: () => void; footer?: ReactNode }) {
  const game = useGame();
  useEffect(() => {
    if (!onClose || game.phase === "open") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, game.phase]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[rgba(42,24,16,0.55)] p-[4%]" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="panel pop-in flex max-h-[88%] w-full flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b-4 border-bean bg-caramel px-[1em] py-[0.5em] text-white">
          <h2 className="text-[1.35em] font-extrabold leading-tight">{title}</h2>
          {onClose && (
            <button className="chip !min-h-[36px] !px-[0.6em] text-bean" onClick={onClose} aria-label="Đóng">
              ✕
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-[1em] py-[0.8em]">{children}</div>
        {footer && <footer className="flex flex-wrap justify-center gap-2 border-t-2 border-[#e9d7c3] px-[1em] py-[0.7em]">{footer}</footer>}
      </section>
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-[0.4em]">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-[0.8em] text-cocoa">{hint}</span>}
      </span>
      <input type="checkbox" className="h-6 w-6 shrink-0 accent-[#e08a3c]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
