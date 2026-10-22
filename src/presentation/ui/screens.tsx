"use client";

import { useState } from "react";
import { QUESTS } from "@/domain/catalog";
import { audio } from "../game/audio";
import { Coin, asset } from "./kit";
import { useGame } from "./useGame";

export function LoadingScreen() {
  const game = useGame();
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-[1.2em] bg-[#3b2416] text-cream">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("logo")} alt="Boba Story" className="floaty w-[55%]" />
      <div className="w-[60%]">
        <div className="h-[0.8em] overflow-hidden rounded-full border-2 border-cream">
          <div className="h-full bg-caramel transition-[width]" style={{ width: `${Math.round(game.loadProgress * 100)}%` }} />
        </div>
        <p className="mt-2 text-center font-bold">Đang mở cửa quán... {Math.round(game.loadProgress * 100)}%</p>
      </div>
    </div>
  );
}

export function MainMenu() {
  const game = useGame();
  const [restoring, setRestoring] = useState(false);
  const [code, setCode] = useState("");
  const start = (fn: () => void) => () => {
    audio.unlock();
    audio.startMusic();
    fn();
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-end gap-[0.7em] bg-gradient-to-b from-[rgba(59,36,22,0.15)] via-[rgba(59,36,22,0.35)] to-[rgba(59,36,22,0.85)] pb-[12%]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset("logo")} alt="Boba Story" className="floaty absolute top-[6%] w-[62%] drop-shadow-xl" />
      <p className="mb-[0.5em] px-[8%] text-center text-[1.05em] font-bold text-cream drop-shadow">Quán trà sữa nhỏ của những vị khách mèo</p>
      {game.hasSave && (
        <button className="btn btn-green w-[62%] text-[1.25em]" onClick={start(() => game.continueGame())}>
          Tiếp tục · Ngày {game.save.day}
        </button>
      )}
      <button
        className={`btn w-[62%] text-[1.25em] ${game.hasSave ? "btn-secondary" : ""}`}
        onClick={start(() => {
          if (!game.hasSave || window.confirm("Bắt đầu lại từ đầu? Tiến trình hiện tại sẽ bị ghi đè.")) game.newGame();
        })}
      >
        Chơi mới
      </button>
      <div className="flex w-[62%] gap-2">
        <button className="btn btn-secondary flex-1" onClick={() => game.openModal("settings")}>
          Cài đặt
        </button>
        <button className="btn btn-secondary flex-1" onClick={() => setRestoring((v) => !v)}>
          Khôi phục
        </button>
      </div>
      {restoring && (
        <form
          className="panel pop-in flex w-[80%] flex-col gap-2 p-[0.8em]"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await game.cloudRestore(code)) setRestoring(false);
          }}
        >
          <label className="font-bold" htmlFor="restore-code">
            Nhập mã khôi phục từ thiết bị cũ
          </label>
          <input
            id="restore-code"
            className="rounded-xl border-2 border-bean bg-white px-3 py-2 text-center font-mono text-[1.1em] uppercase tracking-widest"
            placeholder="XXXX-XXXX-XXXX"
            value={code}
            maxLength={14}
            autoComplete="off"
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" disabled={game.cloudBusy || code.trim().length < 14}>
            {game.cloudBusy ? "Đang tải..." : "Tải bản lưu"}
          </button>
        </form>
      )}
    </div>
  );
}

export function PrepScreen() {
  const game = useGame();
  const s = game.save;
  const low = (["cup", "lid", "milk", "tea_black"] as const).filter((id) => s.inventory[id] < 5);
  const claimable = QUESTS.filter((q) => s.quests[q.id]?.done && !s.quests[q.id]?.claimed).length;
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-[0.6em] bg-gradient-to-t from-[rgba(42,24,16,0.92)] to-transparent px-[5%] pb-[6%] pt-[18%]">
      <div className="panel pop-in w-full p-[0.9em] text-center">
        <h2 className="text-[1.5em] font-extrabold leading-tight">Ngày {s.day} · Chuẩn bị mở cửa</h2>
        <p className="text-cocoa">
          Quỹ: <Coin value={s.money} /> · Danh tiếng {Math.floor(s.reputation)}
        </p>
        {low.length > 0 && <p className="mt-1 font-bold text-berry">Sắp hết: {low.map((id) => ({ cup: "ly", lid: "nắp", milk: "sữa", tea_black: "trà đen" })[id]).join(", ")}</p>}
        <div className="mt-[0.6em] grid grid-cols-3 gap-2">
          <button className="btn btn-secondary !px-2" onClick={() => game.openModal("shop")}>
            Cửa hàng
          </button>
          <button className="btn btn-secondary !px-2" onClick={() => game.openModal("recipes")}>
            Công thức
          </button>
          <button className="btn btn-secondary relative !px-2" onClick={() => game.openModal("quests")}>
            Nhiệm vụ
            {claimable > 0 && <span className="absolute -right-1 -top-2 rounded-full border-2 border-bean bg-berry px-[0.45em] text-[0.8em] text-white">{claimable}</span>}
          </button>
        </div>
      </div>
      <div className="flex w-full gap-2">
        <button className="btn btn-secondary" onClick={() => game.toMenu()} aria-label="Về menu chính">
          ⌂
        </button>
        <button
          className="btn btn-green flex-1 text-[1.35em]"
          onClick={() => {
            audio.unlock();
            audio.startMusic();
            game.openShop();
          }}
        >
          Mở cửa!
        </button>
      </div>
    </div>
  );
}

export function SummaryScreen() {
  const game = useGame();
  const sum = game.lastSummary;
  if (!sum) return null;
  const st = sum.stats;
  const avg = st.served ? Math.round(st.qualitySum / st.served) : 0;
  const rows: [string, React.ReactNode][] = [
    ["Mèo khách đã phục vụ", st.served],
    ["Khách bỏ về", st.lost],
    ["Chất lượng trung bình", `${avg} điểm`],
    ["Ly hoàn hảo", st.perfect],
    ["Doanh thu", <Coin key="r" value={st.revenue} />],
    ["Tiền tip", <Coin key="t" value={st.tips} />],
    ["Thưởng nhiệm vụ", <Coin key="w" value={st.rewards} />],
    ["Chi phí nguyên liệu đã dùng", <Coin key="c" value={st.ingredientValueUsed} />],
  ];
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[rgba(42,24,16,0.6)] p-[5%]">
      <section className="panel pop-in w-full p-[1em]">
        <h2 className="text-center text-[1.6em] font-extrabold">Tổng kết ngày {sum.day}</h2>
        <p className="mb-2 text-center text-cocoa">{st.served === 0 ? "Hôm nay hơi vắng... ngày mai sẽ tốt hơn!" : avg >= 80 ? "Một ngày tuyệt vời, mèo khách rất vui!" : "Một ngày bận rộn đã qua!"}</p>
        <dl className="divide-y-2 divide-[#efe1cf]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between py-[0.3em]">
              <dt>{k}</dt>
              <dd className="font-extrabold">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between py-[0.4em] text-[1.2em]">
            <dt className="font-extrabold">Lợi nhuận</dt>
            <dd className={`font-extrabold ${sum.profit >= 0 ? "text-[#2f6b2f]" : "text-berry"}`}>
              {sum.profit >= 0 ? "+" : ""}
              {sum.profit} xu
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={() => game.openModal("quests")}>
            Nhiệm vụ
          </button>
          <button className="btn btn-green flex-[2]" onClick={() => game.nextDay()}>
            Sang ngày {game.save.day}
          </button>
        </div>
      </section>
    </div>
  );
}
