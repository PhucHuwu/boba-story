import { gameApi } from "@/lib/gameApi";
import { fmtNum, type TelemetryStats } from "@/lib/types";
import { ErrorBox } from "../ErrorBox";

const pct = (a: number, b: number) => (b ? `${fmtNum((a / b) * 100)}%` : "—");
const avg = (a: number, b: number, d = 0) => (b ? fmtNum(a / b, d) : "—");

export default async function StatsPage() {
  const r = await gameApi<TelemetryStats>("/stats");
  if (!r.ok) return <ErrorBox error={r.error} />;
  const { days, daily } = r.data;
  const total = days.reduce((s, d) => s + d.reports, 0);
  const players = days.find((d) => d.day === 1)?.reports ?? 0;
  const maxDaily = Math.max(1, ...daily.map((d) => d.reports));
  const maxReports = Math.max(1, ...days.map((d) => d.reports));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Báo cáo cuối ngày" value={fmtNum(total)} />
        <Kpi label="Lượt chơi xong ngày 1" value={fmtNum(players)} />
        <Kpi label="Ngày chơi xa nhất" value={days.length ? String(days[days.length - 1].day) : "—"} />
        <Kpi label="Báo cáo hôm nay" value={fmtNum(daily[0]?.reports ?? 0)} />
      </div>

      <section className="card">
        <h2 className="mb-3 font-bold">Số báo cáo theo ngày thực (30 ngày, giờ UTC)</h2>
        <div className="flex h-32 items-end gap-[3px]">
          {[...daily].reverse().map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${d.date}: ${d.reports}`}>
              <div className="w-full rounded-t bg-caramel/80" style={{ height: `${(d.reports / maxDaily) * 100}%`, minHeight: d.reports ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-cocoa">
          <span>{daily[daily.length - 1]?.date}</span>
          <span>{daily[0]?.date}</span>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <h2 className="mb-1 font-bold">Theo ngày trong game</h2>
        <p className="mb-3 text-xs text-cocoa">Mỗi dòng gộp mọi người chơi đã đóng cửa ngày đó. Cột &quot;Còn chơi&quot; so với số người xong ngày 1.</p>
        {days.length === 0 ? (
          <p className="text-sm text-cocoa">Chưa có dữ liệu. Thống kê xuất hiện khi người chơi đóng cửa một ngày.</p>
        ) : (
          <table className="w-full min-w-[760px] text-right text-sm tabular-nums">
            <thead className="text-xs text-cocoa">
              <tr className="border-b border-[#e6d6c3]">
                {["Ngày", "Báo cáo", "Còn chơi", "Ly/ngày", "Khách bỏ về", "Chất lượng", "Ly hoàn hảo", "Lãi TB", "Ngày lỗ", "Xu TB", "Danh tiếng TB", "Đạt mục tiêu", "Thư giãn"].map((h) => (
                  <th key={h} className="px-2 py-2 font-semibold first:text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-b border-[#f1e7da] last:border-0">
                  <td className="px-2 py-1.5 text-left font-bold">{d.day}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex w-full items-center justify-end gap-2">
                      <span className="h-1.5 rounded bg-caramel/60" style={{ width: `${(d.reports / maxReports) * 48}px` }} />
                      {d.reports}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{pct(d.reports, players)}</td>
                  <td className="px-2 py-1.5">{avg(d.served, d.reports, 1)}</td>
                  <td className="px-2 py-1.5">{avg(d.lost, d.reports, 1)}</td>
                  <td className="px-2 py-1.5">{avg(d.qualitySum, d.reports)}</td>
                  <td className="px-2 py-1.5">{avg(d.perfect, d.reports, 1)}</td>
                  <td className={`px-2 py-1.5 ${d.profitSum < 0 ? "text-berry" : ""}`}>{avg(d.profitSum, d.reports)}</td>
                  <td className="px-2 py-1.5">{pct(d.losingDays, d.reports)}</td>
                  <td className="px-2 py-1.5">{avg(d.moneySum, d.reports)}</td>
                  <td className="px-2 py-1.5">{avg(d.reputationSum, d.reports)}</td>
                  <td className="px-2 py-1.5">{pct(d.goalsMet, d.reports)}</td>
                  <td className="px-2 py-1.5">{pct(d.relaxed, d.reports)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs text-cocoa">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
