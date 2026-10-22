"use client";

import { useState } from "react";
import { INGREDIENTS, INVENTORY_CAP, LEVEL_UNITS, QUESTS, RECIPES, UPGRADES } from "@/domain/catalog";
import { packCost } from "@/domain/economy";
import type { IngredientId } from "@/domain/types";
import { audio } from "../game/audio";
import { BankModal, ReviewsModal, RivalModal } from "./features";
import { Bar, Coin, Modal, Toggle, asset } from "./kit";
import { useGame } from "./useGame";

const STOCK_ORDER: IngredientId[] = ["cup", "lid", "tea_black", "tea_green", "tea_oolong", "milk", "sugar", "ice", "top_boba", "top_jelly", "top_pudding"];
const ICON: Partial<Record<IngredientId, string>> = { cup: "cup_stack", lid: "sealer" };

function ShopModal() {
  const game = useGame();
  const [tab, setTab] = useState<"stock" | "recipes" | "upgrades">("stock");
  const s = game.save;
  const tabs = [
    ["stock", "Nguyên liệu"],
    ["recipes", "Công thức"],
    ["upgrades", "Nâng cấp"],
  ] as const;
  return (
    <Modal title="Cửa hàng" onClose={() => game.closeModal()} footer={<span className="font-bold">Quỹ hiện có: <Coin value={s.money} /></span>}>
      <div className="mb-3 grid grid-cols-3 gap-1" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`chip justify-center ${tab === id ? "!bg-caramel text-white" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "stock" && (
        <ul className="flex flex-col gap-2">
          {STOCK_ORDER.map((id) => {
            const def = INGREDIENTS[id];
            const n = s.inventory[id];
            const cost = packCost(id);
            return (
              <li key={id} className="flex items-center gap-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(ICON[id] ?? id)} alt="" className="h-11 w-11 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold leading-tight">{def.name}</p>
                  <p className={`text-[0.85em] ${n <= 3 ? "font-bold text-berry" : "text-cocoa"}`}>
                    Còn {n}/{INVENTORY_CAP} · gói {def.pack}
                  </p>
                </div>
                <button className="btn !min-h-[40px] !px-3" disabled={s.money < cost || n + def.pack > INVENTORY_CAP} onClick={() => game.buyIngredient(id)}>
                  <Coin value={cost} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tab === "recipes" && (
        <ul className="flex flex-col gap-2">
          {RECIPES.map((r) => {
            const owned = s.unlockedRecipes.includes(r.id);
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold leading-tight">{r.name}</p>
                  <p className="text-[0.85em] text-cocoa">Giá bán {r.price} xu</p>
                </div>
                {owned ? (
                  <span className="font-bold text-[#2f6b2f]">Đã có</span>
                ) : (
                  <button className="btn !min-h-[40px] !px-3" disabled={s.money < r.unlockCost} onClick={() => game.unlockRecipe(r.id)}>
                    <Coin value={r.unlockCost} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {tab === "upgrades" && (
        <ul className="flex flex-col gap-2">
          {UPGRADES.map((u) => {
            const owned = s.upgrades.includes(u.id);
            return (
              <li key={u.id} className="flex items-center gap-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold leading-tight">{u.name}</p>
                  <p className="text-[0.85em] text-cocoa">{u.description}</p>
                </div>
                {owned ? (
                  <span className="font-bold text-[#2f6b2f]">Đã có</span>
                ) : (
                  <button className="btn !min-h-[40px] !px-3" disabled={s.money < u.cost} onClick={() => game.buyUpgrade(u.id)}>
                    <Coin value={u.cost} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function RecipesModal() {
  const game = useGame();
  const s = game.save;
  return (
    <Modal title="Sổ công thức" onClose={() => game.closeModal()}>
      <p className="mb-2 text-[0.9em] text-cocoa">
        Đường: 0% = 0 bơm, 50% = {LEVEL_UNITS[50]} bơm, 100% = {LEVEL_UNITS[100]} bơm. Đá tương tự theo số muỗng. Rót đến vạch xanh là đầy ly.
      </p>
      <ul className="flex flex-col gap-2">
        {RECIPES.map((r) => {
          const owned = s.unlockedRecipes.includes(r.id);
          return (
            <li key={r.id} className={`rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2 ${owned ? "" : "opacity-55"}`}>
              <p className="font-extrabold">
                {r.name} {owned ? "" : "🔒"}
              </p>
              <p className="text-[0.9em]">
                {INGREDIENTS[r.tea].name} {Math.round(r.teaRatio * 100)}%{r.milkRatio > 0 ? ` · Sữa ${Math.round(r.milkRatio * 100)}%` : ""}
                {r.topping ? ` · ${INGREDIENTS[r.topping].name}` : ""}
              </p>
              <p className="text-[0.85em] text-cocoa">{r.description}</p>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function QuestsModal() {
  const game = useGame();
  const s = game.save;
  return (
    <Modal title="Nhiệm vụ" onClose={() => game.closeModal()}>
      <ul className="flex flex-col gap-2">
        {QUESTS.map((q) => {
          const p = s.quests[q.id] ?? { progress: 0, done: false, claimed: false };
          return (
            <li key={q.id} className={`flex items-center gap-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2 ${p.claimed ? "opacity-55" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold leading-tight">{q.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[0.85em]">
                  <Bar value={p.progress / q.target} />
                  <span className="shrink-0 tabular-nums">
                    {p.progress}/{q.target}
                  </span>
                </div>
              </div>
              {p.claimed ? (
                <span className="font-bold text-[#2f6b2f]">✓</span>
              ) : (
                <button className="btn btn-green !min-h-[40px] !px-3" disabled={!p.done} onClick={() => game.claimQuest(q.id)}>
                  <Coin value={q.reward} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function SettingsModal() {
  const game = useGame();
  const st = game.save.settings;
  const volume = (key: "music" | "sfx", v: number) => {
    game.updateSettings({ [key]: v });
    const next = { ...st, [key]: v };
    audio.setVolumes(next.music, next.sfx);
  };
  return (
    <Modal title="Cài đặt" onClose={() => game.closeModal()}>
      {(["music", "sfx"] as const).map((k) => (
        <label key={k} className="flex items-center gap-3 py-[0.4em]">
          <span className="w-24 font-bold">{k === "music" ? "Nhạc nền" : "Hiệu ứng"}</span>
          <input type="range" min={0} max={1} step={0.05} value={st[k]} className="flex-1 accent-[#e08a3c]" onChange={(e) => volume(k, Number(e.target.value))} />
          <span className="w-10 text-right tabular-nums">{Math.round(st[k] * 100)}</span>
        </label>
      ))}
      <Toggle label="Chế độ thư giãn" hint="Mèo khách không bỏ về, không mất danh tiếng." checked={st.relaxed} onChange={(v) => game.updateSettings({ relaxed: v })} />
      <Toggle label="Gợi ý pha chế" hint="Hiện vạch mục tiêu trên ly và hướng dẫn." checked={st.hints} onChange={(v) => game.updateSettings({ hints: v })} />
      <Toggle label="Giảm chuyển động" hint="Ít hiệu ứng nhún nhảy, đi lại nhanh hơn." checked={st.reducedMotion} onChange={(v) => game.updateSettings({ reducedMotion: v })} />
      <div className="mt-3 flex flex-wrap gap-2 border-t-2 border-[#efe1cf] pt-3">
        <button className="btn btn-secondary flex-1" onClick={() => game.openModal("cloud")}>
          Lưu đám mây
        </button>
        <button
          className="btn btn-danger flex-1"
          onClick={() => {
            if (window.confirm("Xóa toàn bộ dữ liệu lưu trên máy này?")) {
              game.deleteSave();
              game.toMenu();
            }
          }}
        >
          Xóa dữ liệu
        </button>
      </div>
    </Modal>
  );
}

function CloudModal() {
  const game = useGame();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Lưu đám mây" onClose={() => game.closeModal()}>
      <p className="text-[0.95em]">Mã khôi phục của bạn — dùng để chơi tiếp trên thiết bị khác:</p>
      <button
        className="my-2 w-full rounded-2xl border-[3px] border-dashed border-bean bg-white py-2 font-mono text-[1.4em] font-bold tracking-widest"
        onClick={() => {
          void navigator.clipboard?.writeText(game.recoveryCode).then(() => setCopied(true));
        }}
      >
        {game.recoveryCode}
      </button>
      <p className="mb-2 text-center text-[0.8em] text-cocoa">{copied ? "Đã sao chép!" : "Chạm để sao chép. Hãy giữ mã này bí mật."}</p>
      <button className="btn w-full" disabled={game.cloudBusy} onClick={() => game.cloudSync()}>
        {game.cloudBusy ? "Đang lưu..." : "Lưu lên đám mây ngay"}
      </button>
      <form
        className="mt-4 flex flex-col gap-2 border-t-2 border-[#efe1cf] pt-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (window.confirm("Tải bản lưu từ đám mây sẽ ghi đè tiến trình trên máy này. Tiếp tục?") && (await game.cloudRestore(code))) game.toMenu();
        }}
      >
        <label htmlFor="cloud-code" className="font-bold">
          Khôi phục bằng mã khác
        </label>
        <input
          id="cloud-code"
          className="rounded-xl border-2 border-bean bg-white px-3 py-2 text-center font-mono uppercase tracking-widest"
          placeholder="XXXX-XXXX-XXXX"
          maxLength={14}
          value={code}
          autoComplete="off"
          onChange={(e) => setCode(e.target.value)}
        />
        <button className="btn btn-secondary" disabled={game.cloudBusy || code.trim().length < 14}>
          Tải bản lưu
        </button>
      </form>
    </Modal>
  );
}

function PauseModal() {
  const game = useGame();
  return (
    <Modal
      title="Tạm dừng"
      onClose={() => game.closeModal()}
      footer={
        <button className="btn btn-green w-full text-[1.2em]" onClick={() => game.closeModal()}>
          Tiếp tục bán
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-secondary" onClick={() => game.openModal("shop")}>
          Cửa hàng
        </button>
        <button className="btn btn-secondary" onClick={() => game.openModal("recipes")}>
          Công thức
        </button>
        <button className="btn btn-secondary" onClick={() => game.openModal("quests")}>
          Nhiệm vụ
        </button>
        <button className="btn btn-secondary" onClick={() => game.openModal("settings")}>
          Cài đặt
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t-2 border-[#efe1cf] pt-3">
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm("Đóng cửa sớm? Các mèo khách đang chờ sẽ ra về.")) game.requestEndDay();
          }}
        >
          Đóng cửa sớm
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (window.confirm("Về menu chính? Ngày hôm nay sẽ kết thúc dở dang và không được tổng kết.")) game.toMenu();
          }}
        >
          Về menu chính
        </button>
      </div>
    </Modal>
  );
}

export function Modals() {
  const game = useGame();
  switch (game.modal) {
    case "shop":
      return <ShopModal />;
    case "recipes":
      return <RecipesModal />;
    case "quests":
      return <QuestsModal />;
    case "settings":
      return <SettingsModal />;
    case "cloud":
      return <CloudModal />;
    case "pause":
      return <PauseModal />;
    case "reviews":
      return <ReviewsModal />;
    case "bank":
      return <BankModal />;
    case "rival":
      return <RivalModal />;
    default:
      return null;
  }
}
