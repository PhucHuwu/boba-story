"use client";

import { useState, useTransition } from "react";
import { CATEGORY_LABEL, fmtTime, type FeedbackEntry } from "@/lib/types";
import { deleteFeedback, setHandled } from "../actions";

const CATEGORY_STYLE: Record<string, string> = {
  bug: "bg-[#fdf0ee] text-berry",
  idea: "bg-[#e7f3e4] text-matcha",
  difficulty: "bg-[#fff1df] text-caramel",
  other: "bg-[#f1ebe4] text-cocoa",
};

export function FeedbackItem({ entry: e }: { entry: FeedbackEntry }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<string | null>) => start(async () => setError(await fn()));
  return (
    <li className={`card flex flex-col gap-2 ${e.handled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-bold ${CATEGORY_STYLE[e.category] ?? CATEGORY_STYLE.other}`}>{CATEGORY_LABEL[e.category] ?? e.category}</span>
        {e.rating !== null && <span className="font-bold text-caramel">{"★".repeat(e.rating)}{"☆".repeat(5 - e.rating)}</span>}
        <span className="text-cocoa">#{e.id} · {fmtTime(e.createdAt)}</span>
        {e.handled && <span className="rounded-full bg-[#e7f3e4] px-2 py-0.5 font-bold text-matcha">Đã xử lý</span>}
      </div>
      <p className="whitespace-pre-wrap break-words">{e.message}</p>
      <p className="text-xs text-cocoa">
        Ngày {e.context.day} · {e.context.money} xu · danh tiếng {e.context.reputation} · màn {e.context.screen || e.context.phase || "?"} · bản {e.version}
      </p>
      <details className="text-xs text-cocoa">
        <summary className="cursor-pointer">Thiết bị</summary>
        <p className="mt-1 break-all">{e.userAgent || "—"}</p>
      </details>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" disabled={pending} onClick={() => run(() => setHandled(e.id, !e.handled))}>
          {e.handled ? "Mở lại" : "Đánh dấu đã xử lý"}
        </button>
        <button
          className="btn-danger"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Xoá góp ý #${e.id}?`)) run(() => deleteFeedback(e.id));
          }}
        >
          Xoá
        </button>
        {error && <span className="self-center text-sm text-berry">{error}</span>}
      </div>
    </li>
  );
}
