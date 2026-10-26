import Link from "next/link";
import { gameApi } from "@/lib/gameApi";
import { CATEGORY_LABEL, type FeedbackList } from "@/lib/types";
import { ErrorBox } from "./ErrorBox";
import { FeedbackItem } from "./FeedbackItem";

const STATUS = [
  ["open", "Chưa xử lý"],
  ["done", "Đã xử lý"],
  ["all", "Tất cả"],
] as const;

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" && sp.category in CATEGORY_LABEL ? sp.category : "";
  const status = STATUS.find(([s]) => s === sp.status)?.[0] ?? "open";
  const q = new URLSearchParams({ limit: "200" });
  if (category) q.set("category", category);
  if (status !== "all") q.set("handled", String(status === "done"));
  const r = await gameApi<FeedbackList>(`/feedback?${q}`);
  const href = (patch: Record<string, string>) => `/?${new URLSearchParams({ status, ...(category ? { category } : {}), ...patch })}`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {STATUS.map(([s, label]) => (
          <Link key={s} href={href({ status: s })} className={status === s ? "btn" : "btn-ghost"}>
            {label}
          </Link>
        ))}
        <span className="mx-1 h-6 w-px bg-[#e6d6c3]" />
        <Link href={href({ category: "" })} className={!category ? "btn" : "btn-ghost"}>
          Mọi loại
        </Link>
        {Object.entries(CATEGORY_LABEL).map(([c, label]) => (
          <Link key={c} href={href({ category: c })} className={category === c ? "btn" : "btn-ghost"}>
            {label}
          </Link>
        ))}
      </div>
      {!r.ok ? (
        <ErrorBox error={r.error} />
      ) : (
        <>
          <p className="text-sm text-cocoa">
            Đang hiện {r.data.items.length} góp ý · tổng {r.data.total} · chưa xử lý {r.data.open}
          </p>
          {r.data.items.length === 0 ? (
            <p className="card text-sm text-cocoa">Chưa có góp ý nào khớp bộ lọc.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {r.data.items.map((e) => (
                <FeedbackItem key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
