import { gameApi } from "@/lib/gameApi";
import { fmtNum, fmtTime, type SaveLookup } from "@/lib/types";
import { ErrorBox } from "../ErrorBox";

export default async function SavesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code.trim().toUpperCase().slice(0, 20) : "";
  const r = code ? await gameApi<SaveLookup>(`/saves?code=${encodeURIComponent(code)}`) : null;

  return (
    <>
      <form className="card flex flex-col gap-2 sm:flex-row sm:items-end" action="/saves">
        <div className="flex-1">
          <label className="label" htmlFor="code">
            Mã khôi phục của người chơi
          </label>
          <input id="code" name="code" defaultValue={code} placeholder="XXXX-XXXX-XXXX" className="input font-mono uppercase tracking-widest" autoComplete="off" />
        </div>
        <button className="btn">Tra cứu</button>
      </form>
      <p className="text-xs text-cocoa">Chỉ xem, không sửa. Bản lưu đám mây được cập nhật khi người chơi đóng cửa mỗi ngày hoặc bấm &quot;Lưu lên đám mây&quot;.</p>
      {r && !r.ok && <ErrorBox error={r.error} />}
      {r?.ok && <SaveView data={r.data} />}
    </>
  );
}

function SaveView({ data: { code, save: s, raw } }: { data: SaveLookup }) {
  const rows: [string, string][] = [
    ["Ngày hiện tại", String(s.day)],
    ["Xu trong quầy", fmtNum(s.money)],
    ["Tiết kiệm", fmtNum(s.bank)],
    ["Danh tiếng", fmtNum(s.reputation, 1)],
    ["Nợ ngân hàng", s.loan ? `${fmtNum(s.loan.remaining)} (góp ${fmtNum(s.loan.installment)}/ngày)` : "Không"],
    ["Nợ quá hạn", fmtNum(s.overdue)],
    ["Hướng dẫn", s.tutorialDone ? "Đã xong" : "Chưa xong"],
    ["Cập nhật lúc", fmtTime(s.updatedAt)],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card">
        <h2 className="mb-2 font-bold">
          Bản lưu <span className="font-mono">{code}</span>
        </h2>
        <dl className="divide-y divide-[#f1e7da] text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-1.5">
              <dt className="text-cocoa">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="card text-sm">
        <h2 className="mb-2 font-bold">Thành tích</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.entries(s.stats).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-cocoa">{k}</dt>
              <dd className="font-semibold tabular-nums">{fmtNum(Number(v))}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mb-1 mt-3 font-bold">Công thức đã mở</h2>
        <p>{s.unlockedRecipes.join(", ") || "—"}</p>
        <h2 className="mb-1 mt-3 font-bold">Nâng cấp</h2>
        <p>{s.upgrades.join(", ") || "—"}</p>
        <h2 className="mb-1 mt-3 font-bold">Kho</h2>
        <p className="tabular-nums">
          {Object.entries(s.inventory)
            .map(([k, v]) => `${k} ${v}`)
            .join(" · ")}
        </p>
      </section>
      <details className="card lg:col-span-2">
        <summary className="cursor-pointer font-bold">Dữ liệu gốc (JSON)</summary>
        <pre className="mt-2 max-h-[60vh] overflow-auto rounded-lg bg-[#2a1810] p-3 text-xs text-cream">{JSON.stringify(raw, null, 2)}</pre>
      </details>
    </div>
  );
}
