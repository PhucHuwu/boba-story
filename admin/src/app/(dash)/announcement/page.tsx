import { gameApi } from "@/lib/gameApi";
import { TONE_LABEL, fmtTime, type Announcement } from "@/lib/types";
import { ErrorBox } from "../ErrorBox";
import { AnnouncementForm, ClearButton } from "./AnnouncementForm";

export default async function AnnouncementPage() {
  const r = await gameApi<{ announcement: Announcement | null }>("/announcement");
  if (!r.ok) return <ErrorBox error={r.error} />;
  const a = r.data.announcement;
  const expired = a?.expiresAt !== null && a?.expiresAt !== undefined && a.expiresAt <= Date.now();
  return (
    <>
      <section className="card">
        <h2 className="mb-2 font-bold">Thông báo đang hiện ở menu game</h2>
        {a ? (
          <div className="flex flex-col gap-2">
            <p className="whitespace-pre-line rounded-lg border border-[#e6d6c3] bg-cream p-3">{a.text}</p>
            <p className="text-xs text-cocoa">
              {TONE_LABEL[a.tone] ?? a.tone} · đăng {fmtTime(a.createdAt)} · {a.expiresAt ? `${expired ? "đã hết hạn" : "hết hạn"} ${fmtTime(a.expiresAt)}` : "không hết hạn"}
            </p>
            <ClearButton />
          </div>
        ) : (
          <p className="text-sm text-cocoa">Không có thông báo nào.</p>
        )}
      </section>
      <section className="card">
        <h2 className="mb-2 font-bold">{a ? "Thay bằng thông báo mới" : "Đăng thông báo"}</h2>
        <AnnouncementForm />
      </section>
    </>
  );
}
