"use client";

import { useState } from "react";
import { INGREDIENTS, INVENTORY_CAP, LEVEL_UNITS, QUESTS, RECIPES, UPGRADES } from "@/domain/catalog";
import { FEEDBACK_CATEGORIES, FEEDBACK_LABEL, FEEDBACK_MAX_CHARS, FEEDBACK_MIN_CHARS, type FeedbackCategory } from "@/domain/community";
import { packCost } from "@/domain/economy";
import type { IngredientId } from "@/domain/types";
import { audio } from "../game/audio";
import { SHORTCUT_HELP } from "../game/keymap";
import { BankModal, ReviewsModal, RivalModal } from "./features";
import { Bar, Coin, Icon, Modal, Toggle, asset } from "./kit";
import { useGame } from "./useGame";

const STOCK_ORDER: IngredientId[] = ["cup", "lid", "tea_black", "tea_green", "tea_oolong", "milk", "sugar", "ice", "top_boba", "top_jelly", "top_pudding"];
const ICON: Partial<Record<IngredientId, string>> = { cup: "cup_stack", lid: "sealer" };
const UPGRADE_ICON: Record<string, string> = { camera: "icon_camera", safe: "icon_safe" };

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
                <Icon name={`drink_${r.id}`} className="h-12 w-12" />
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
                <Icon name={UPGRADE_ICON[u.id] ?? `upg_${u.id}`} className="h-11 w-11" />
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
            <li key={r.id} className={`flex items-start gap-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2 ${owned ? "" : "opacity-55"}`}>
              <Icon name={`drink_${r.id}`} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
              <p className="font-extrabold">
                {r.name} {!owned && <Icon name="icon_lock" className="ml-1 h-[1.1em] w-[1.1em]" alt="Chưa mở khóa" />}
              </p>
              <p className="text-[0.9em]">
                {INGREDIENTS[r.tea].name} {Math.round(r.teaRatio * 100)}%{r.milkRatio > 0 ? ` · Sữa ${Math.round(r.milkRatio * 100)}%` : ""}
                {r.topping ? ` · ${INGREDIENTS[r.topping].name}` : ""}
              </p>
              <p className="text-[0.85em] text-cocoa">{r.description}</p>
              </div>
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
      <div className="mb-2 flex justify-center">
        <Icon name="icon_quests" className="h-16 w-16" />
      </div>
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
                <span className="font-bold text-[#2f6b2f]">Đã nhận</span>
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
      <Toggle
        label="Gửi thống kê ẩn danh"
        hint="Cuối mỗi ngày gửi số ly, chất lượng, lợi nhuận (không kèm thông tin cá nhân) để cân bằng độ khó."
        checked={st.telemetry}
        onChange={(v) => game.updateSettings({ telemetry: v })}
      />
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

function FeedbackModal() {
  const game = useGame();
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  // Opened from the pause menu mid-day: go back there instead of resuming play.
  const close = () => (game.phase === "open" ? game.openModal("pause") : game.closeModal());
  const text = message.trim();
  return (
    <Modal title="Góp ý cho quán" onClose={close}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await game.sendFeedback(category, text, rating, game.phase)) close();
        }}
      >
        <p className="text-[0.9em] text-cocoa">Bạn gặp lỗi, có ý tưởng hay thấy game quá khó/dễ? Nhà phát triển đọc từng góp ý. Ngày chơi, số xu và danh tiếng hiện tại sẽ được gửi kèm, không có thông tin cá nhân.</p>
        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Loại góp ý">
          {FEEDBACK_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              className={`chip justify-center !px-1 ${category === c ? "!bg-caramel text-white" : ""}`}
              onClick={() => setCategory(c)}
            >
              {FEEDBACK_LABEL[c]}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-bold">Nội dung</span>
          <textarea
            className="min-h-[7em] rounded-xl border-2 border-bean bg-white px-3 py-2"
            maxLength={FEEDBACK_MAX_CHARS}
            value={message}
            placeholder="Ví dụ: mèo khách đi quá nhanh ở ngày 5..."
            onChange={(e) => setMessage(e.target.value)}
          />
          <span className="self-end text-[0.75em] text-cocoa tabular-nums">
            {message.length}/{FEEDBACK_MAX_CHARS}
          </span>
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">Chấm điểm game (tùy chọn)</span>
          <span className="inline-flex" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} sao`}
                className="p-[0.15em]"
                onClick={() => setRating(rating === n ? null : n)}
              >
                <Icon name="star" className={`h-[1.6em] w-[1.6em] ${rating !== null && n <= rating ? "" : "opacity-35 grayscale"}`} />
              </button>
            ))}
          </span>
        </div>
        <button className="btn btn-green" disabled={game.feedbackBusy || text.length < FEEDBACK_MIN_CHARS}>
          {game.feedbackBusy ? "Đang gửi..." : "Gửi góp ý"}
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
          <Icon name="icon_shop" />
          Cửa hàng
        </button>
        <button className="btn btn-secondary" onClick={() => game.openModal("recipes")}>
          <Icon name="icon_recipes" />
          Công thức
        </button>
        <button className="btn btn-secondary" onClick={() => game.openModal("quests")}>
          <Icon name="icon_quests" />
          Nhiệm vụ
        </button>
        <button className="btn btn-secondary" onClick={() => game.openModal("settings")}>
          Cài đặt
        </button>
        <button className="btn btn-secondary col-span-2" onClick={() => game.openModal("feedback")}>
          Góp ý cho quán
        </button>
      </div>
      <details className="mt-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 px-3 py-2">
        <summary className="cursor-pointer font-extrabold">Phím tắt (bàn phím)</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.9em]">
          {SHORTCUT_HELP.map(([keys, text]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded-md border-2 border-bean bg-cream px-1.5 font-extrabold whitespace-nowrap">{keys}</kbd>
              </dt>
              <dd className="text-cocoa">{text}</dd>
            </div>
          ))}
        </dl>
      </details>
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
    case "feedback":
      return <FeedbackModal />;
    default:
      return null;
  }
}
