"use client";

import { useActionState, useState, useTransition } from "react";
import { TONE_LABEL } from "@/lib/types";
import { clearAnnouncement, postAnnouncement } from "../../actions";

const MAX = 280;

export function AnnouncementForm() {
  const [state, action, pending] = useActionState(postAnnouncement, undefined);
  const [text, setText] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="text">
          Nội dung (tối đa {MAX} ký tự)
        </label>
        <textarea id="text" name="text" className="input min-h-24" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} required />
        <p className="mt-1 text-right text-xs text-cocoa tabular-nums">
          {text.length}/{MAX}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tone">
            Kiểu
          </label>
          <select id="tone" name="tone" className="input" defaultValue="info">
            {Object.entries(TONE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="hours">
            Tự gỡ sau
          </label>
          <select id="hours" name="hours" className="input" defaultValue="0">
            <option value="0">Không tự gỡ</option>
            <option value="6">6 giờ</option>
            <option value="24">1 ngày</option>
            <option value="72">3 ngày</option>
            <option value="168">7 ngày</option>
            <option value="720">30 ngày</option>
          </select>
        </div>
      </div>
      {state?.error && <p className="text-sm text-berry">{state.error}</p>}
      {state?.ok && <p className="text-sm text-matcha">{state.ok}</p>}
      <button className="btn self-start" disabled={pending || !text.trim()}>
        {pending ? "Đang đăng..." : "Đăng thông báo"}
      </button>
    </form>
  );
}

export function ClearButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-danger"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Gỡ thông báo khỏi menu game?")) start(async () => setError(await clearAnnouncement()));
        }}
      >
        Gỡ thông báo
      </button>
      {error && <span className="text-sm text-berry">{error}</span>}
    </div>
  );
}
