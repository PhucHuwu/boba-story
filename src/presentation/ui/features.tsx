"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES } from "@/domain/catalog";
import { GOAL_TEXT, WEATHER, goalStatus } from "@/domain/dayPlan";
import { depositFee, rentFor } from "@/domain/night";
import { RATING_WINDOW, starDistribution } from "@/domain/reviews";
import { RIVAL_EVENTS, RIVAL_NAME } from "@/domain/rivalEvents";
import type { Review } from "@/domain/types";
import { audio } from "../game/audio";
import { Bar, Coin, Icon, Modal } from "./kit";
import { useGame } from "./useGame";

const WEATHER_ICON = (id: string) => `icon_${id}`;

function StarIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="inline-block h-[1em] w-[1em] align-[-0.12em]" aria-hidden>
      <path
        d="M12 2.8l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.87l-5.5 2.88 1.05-6.12L3.1 9.3l6.15-.9z"
        fill={on ? "#f2b630" : "#e6d6c1"}
        stroke={on ? "#8a5a1b" : "#c9b39a"}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex gap-[0.05em] ${className}`} role="img" aria-label={`${value} sao`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <StarIcon key={i} on={i < full} />
      ))}
    </span>
  );
}

export function ReviewItem({ r }: { r: Review }) {
  return (
    <li className={`rounded-2xl border-2 p-2 ${r.fake ? "border-[#e2b4ae] bg-[#fdf0ee]" : r.critic ? "border-caramel bg-[#fff3e2]" : "border-[#e9d7c3] bg-white/60"}`}>
      <div className="flex items-center justify-between gap-2 text-[0.85em]">
        <span className="font-bold">
          {r.fake ? "Tài khoản lạ" : ARCHETYPES[r.archetype].name}
          {r.critic && (
            <span className="ml-1 inline-flex items-center gap-1 text-caramel">
              <Icon name="icon_critic" className="h-[1.3em] w-[1.3em]" /> Food reviewer
            </span>
          )}
        </span>
        <span className="shrink-0 text-cocoa">Ngày {r.day}</span>
      </div>
      <Stars value={r.stars} />
      <p className="text-[0.95em] leading-snug">{r.text}</p>
    </li>
  );
}

/** Small rating chip used in the HUD and prep screen. */
export function RatingChip() {
  const game = useGame();
  const rating = game.rating;
  return (
    <button className="chip pointer-events-auto" onClick={() => game.openModal("reviews")} aria-label="Xem đánh giá">
      <StarIcon on /> {rating === null ? "–" : rating.toFixed(1)}
    </button>
  );
}

export function ReviewsModal() {
  const game = useGame();
  const [filter, setFilter] = useState<"all" | "bad" | "good">("all");
  const all = game.save.reviews;
  const dist = starDistribution(all.slice(-RATING_WINDOW));
  const recent = Math.max(1, Math.min(all.length, RATING_WINDOW));
  const list = [...all].reverse().filter((r) => (filter === "all" ? true : filter === "bad" ? r.stars <= 2 : r.stars >= 4));
  const rating = game.rating;
  return (
    <Modal title="Đánh giá của quán" onClose={() => game.closeModal()}>
      <div className="mb-3 flex items-center gap-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
        <div className="text-center">
          <p className="text-[2.2em] font-extrabold leading-none">{rating === null ? "–" : rating.toFixed(1)}</p>
          <Stars value={rating ?? 0} />
          <p className="text-[0.75em] text-cocoa">{all.length} đánh giá</p>
        </div>
        <div className="flex flex-1 flex-col gap-[0.1em] text-[0.8em]">
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-1">
              <span className="w-3">{s}</span>
              <Bar value={dist[s - 1] / recent} color="#e0a21c" />
            </div>
          ))}
        </div>
      </div>
      <p className="mb-2 text-[0.85em] text-cocoa">Điểm tính trên {RATING_WINDOW} đánh giá gần nhất. Điểm cao kéo thêm mèo khách — và cả sự ghen tị của {RIVAL_NAME}.</p>
      <div className="mb-2 grid grid-cols-3 gap-1">
        {(
          [
            ["all", "Tất cả"],
            ["good", "Khen"],
            ["bad", "Chê"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className={`chip justify-center ${filter === id ? "!bg-caramel text-white" : ""}`} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? <p className="py-4 text-center text-cocoa">Chưa có đánh giá nào.</p> : <ul className="flex flex-col gap-2">{list.slice(0, 40).map((r) => <ReviewItem key={r.id} r={r} />)}</ul>}
    </Modal>
  );
}

/** Weather + goal for today, shown on the prep screen. */
export function DayCard() {
  const game = useGame();
  const plan = game.save.plan;
  if (!plan) return null;
  const w = WEATHER[plan.weather];
  return (
    <div className="mt-[0.5em] grid grid-cols-2 gap-2 text-left text-[0.9em]">
      <div className="rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
        <p className="font-extrabold">
          <Icon name={WEATHER_ICON(w.id)} className="mr-1 h-[1.5em] w-[1.5em]" />
          {w.name}
        </p>
        <p className="leading-snug text-cocoa">{w.description}</p>
      </div>
      <div className="rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
        <p className="font-extrabold">
          <Icon name="icon_goal" className="mr-1 h-[1.5em] w-[1.5em]" />
          Mục tiêu
        </p>
        <p className="leading-snug">{GOAL_TEXT[plan.goal.kind](plan.goal.target)}</p>
        <p className="text-cocoa">
          Thưởng <Coin value={plan.goal.reward} />
        </p>
      </div>
    </div>
  );
}

/** Live goal / combo / effects line under the HUD while the shop is open. */
export function DayStatus() {
  const game = useGame();
  const plan = game.save.plan;
  const s = game.session;
  if (game.phase !== "open" || !game.save.tutorialDone) return null;
  const goal = plan && plan.day === game.save.day ? goalStatus(plan.goal, game.dayStats) : null;
  const effects: [string, string][] = [];
  if (s.mod("priceMul") < 1) effects.push(["icon_discount", "Đang giảm giá"]);
  if (s.mod("pourMul") < 1) effects.push(["icon_wrench", "Vòi chảy chậm"]);
  if (s.mod("decayMul") > 1) effects.push(["icon_mic", "Ồn ào"]);
  if (s.trash.length) effects.push(["trash_can", `${s.trash.length} rác`]);
  return (
    <div className="flex flex-wrap items-center gap-[0.3em] text-[0.8em]">
      {plan && (
        <span className="chip !min-h-0 !cursor-default !px-[0.3em] !py-[0.1em]" title={WEATHER[plan.weather].name}>
          <Icon name={WEATHER_ICON(plan.weather)} alt={WEATHER[plan.weather].name} />
        </span>
      )}
      {goal && (
        <span className={`chip !min-h-0 !cursor-default !py-[0.1em] ${goal.met ? "!bg-[#e3f4dc]" : ""}`}>
          <Icon name="icon_goal" />
          {goal.met ? "Xong: " : ""}
          {goal.label}
          {plan && plan.goal.kind !== "noLost" && !goal.met ? ` (${goal.value})` : ""}
        </span>
      )}
      {s.combo >= 2 && <span className="chip pop-in !min-h-0 !cursor-default !bg-caramel !py-[0.1em] text-white">
          <Icon name="icon_combo" /> Combo x{s.combo}
        </span>}
      {effects.map(([icon, label]) => (
        <span key={label} className="chip !min-h-0 !cursor-default !bg-[#fde2dc] !py-[0.1em]">
          <Icon name={icon} />
          {label}
        </span>
      ))}
    </div>
  );
}

export function RivalModal() {
  const game = useGame();
  const id = game.rivalEvent;
  useEffect(() => {
    if (!id) return;
    audio.play("event");
    audio.setMood("tense");
    return () => audio.setMood("day");
  }, [id]);
  if (!id) return null;
  const ev = RIVAL_EVENTS[id];
  return (
    <Modal title={ev.title}>
      <div className="mb-1 flex justify-center">
        <Icon name={[`rival_${ev.id}`, "rival_dog"]} className="h-[7em] w-[7em]" alt={RIVAL_NAME} />
      </div>
      <p className="mb-3 text-center leading-snug">{ev.story}</p>
      <div className="flex flex-col gap-2">
        {ev.options.map((o, i) => (
          <button key={o.label} className="btn btn-secondary !flex-col !items-stretch !py-[0.5em] text-left" disabled={game.save.money < o.cost} onClick={() => game.chooseRival(i)}>
            <span className="flex items-center justify-between gap-2">
              <span>{o.label}</span>
              {o.cost > 0 && <Coin value={o.cost} />}
            </span>
            <span className="text-[0.8em] font-semibold text-cocoa">{o.hint}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function BankModal() {
  const game = useGame();
  const s = game.save;
  const [amount, setAmount] = useState(0);
  const max = s.bank;
  return (
    <Modal title="Ngân hàng Mèo Thần Tài" onClose={() => game.closeModal()} footer={<span className="font-bold">Tiền mặt: <Coin value={s.money} /></span>}>
      <div className="mb-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
          <p className="text-[0.85em] text-cocoa">Tiết kiệm</p>
          <p className="text-[1.3em]">
            <Coin value={s.bank} />
          </p>
        </div>
        <div className="rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
          <p className="text-[0.85em] text-cocoa">Đang nợ</p>
          <p className="text-[1.3em] text-berry">
            <Coin value={s.loan?.remaining ?? 0} />
          </p>
          {s.loan && <p className="text-[0.75em] text-cocoa">Trả góp {s.loan.installment} xu/sáng</p>}
        </div>
      </div>
      <p className="mb-2 text-[0.85em] text-cocoa">Tiền gửi ngân hàng an toàn trước trộm. Gửi vào buổi tối (phí 2%), rút ra bất cứ lúc nào để nhập hàng.</p>
      {max > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <span className="shrink-0 font-bold">Rút</span>
            <input type="range" min={0} max={max} step={1} value={Math.min(amount, max)} className="flex-1 accent-[#e08a3c]" onChange={(e) => setAmount(Number(e.target.value))} />
            <span className="w-14 text-right tabular-nums">{Math.min(amount, max)}</span>
          </label>
          <button className="btn" disabled={amount <= 0} onClick={() => (game.withdraw(amount), setAmount(0))}>
            Rút tiền
          </button>
        </div>
      )}
      {s.loan && (
        <button className="btn btn-green w-full" disabled={s.money <= 0} onClick={() => game.repayLoan(s.money)}>
          Trả nợ sớm bằng tiền mặt
        </button>
      )}
    </Modal>
  );
}

/** Night: choose how much cash to put in the bank before going home; then the morning report. */
export function NightScreen() {
  const game = useGame();
  const s = game.save;
  const report = game.lastNight;
  const [amount, setAmount] = useState(() => Math.floor(s.money * 0.8));
  const [anim, setAnim] = useState(false);
  useEffect(() => {
    audio.setMood("night");
    return () => audio.setMood("day");
  }, []);
  useEffect(() => {
    if (!report) return;
    if (report.robbed) {
      audio.play("crash");
      const t = setTimeout(() => audio.play("alarm"), 500);
      return () => clearTimeout(t);
    }
    audio.play(report.overdue > 0 ? "bad" : "bell");
  }, [report]);

  const fee = depositFee(amount);
  const rent = rentFor(s.day);
  return (
    <div className={`pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-[5%] ${report?.robbed ? "bg-[rgba(40,6,6,0.9)]" : "bg-[rgba(14,16,40,0.88)]"}`}>
      <section className="panel pop-in max-h-full w-full max-w-[28em] overflow-y-auto p-[1em]">
        {!report ? (
          <>
            <h2 className="text-center text-[1.5em] font-extrabold">
              <Icon name="icon_moon" className="mr-1 h-[1.4em] w-[1.4em]" />
              Đêm ngày {s.day - 1}
            </h2>
            <p className="mb-2 text-center text-cocoa">Quán đã đóng cửa. Mang bao nhiêu tiền đi gửi ngân hàng trước khi về nhà?</p>
            <div className="mb-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
                <p className="text-[0.85em] text-cocoa">Tiền mặt trong quầy</p>
                <Coin value={s.money - amount} />
              </div>
              <div className="rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2">
                <p className="text-[0.85em] text-cocoa">Gửi ngân hàng</p>
                <Coin value={amount} />
              </div>
            </div>
            <input type="range" min={0} max={s.money} step={1} value={amount} className="w-full accent-[#e08a3c]" onChange={(e) => setAmount(Number(e.target.value))} aria-label="Số tiền gửi" />
            <ul className="my-2 flex list-disc flex-col gap-1 pl-[1.2em] text-[0.85em] text-cocoa">
              <li>Phí gửi: {fee} xu. Tiền trong ngân hàng không bị trộm lấy.</li>
              <li>
                Sáng mai thu tiền mặt bằng: {rent} xu{s.loan ? ` + trả góp ${Math.min(s.loan.installment, s.loan.remaining)} xu` : ""} (thiếu sẽ trừ vào tiết kiệm).
              </li>
              <li>{s.upgrades.includes("camera") ? "Camera đang canh quán." : "Không có camera, quán dễ bị dòm ngó."}</li>
              {s.upgrades.includes("safe") && <li>Có két sắt giữ tiền.</li>}
            </ul>
            <div className="mb-2 flex justify-center gap-3">
              {s.upgrades.includes("camera") && <Icon name="icon_camera" className="h-[2.4em] w-[2.4em]" alt="Camera" />}
              {s.upgrades.includes("safe") && <Icon name="icon_safe" className="h-[2.4em] w-[2.4em]" alt="Két sắt" />}
            </div>
            <button
              className="btn btn-green w-full text-[1.2em]"
              disabled={anim}
              onClick={() => {
                setAnim(true);
                setTimeout(() => game.endNight(amount), 900);
              }}
            >
              {anim ? "Zzz..." : "Khóa cửa đi ngủ"}
            </button>
          </>
        ) : (
          <MorningReport />
        )}
      </section>
    </div>
  );
}

function MorningReport() {
  const game = useGame();
  const r = game.lastNight!;
  const s = game.save;
  return (
    <>
      {r.robbed ? (
        <>
          <div className="flex justify-center">
            <Icon name={["robber", "icon_safe"]} className="shake h-[6em] w-[6em]" alt="Kẻ trộm" />
          </div>
          <h2 className="text-center text-[1.5em] font-extrabold text-berry">QUÁN BỊ TRỘM ĐỘT NHẬP!</h2>
          <p className="mb-2 text-center">
            Sáng ra cửa bị cạy, ngăn kéo trống trơn. Kẻ gian đã cuỗm mất <b className="text-berry">{r.stolen} xu</b>.
            {s.upgrades.includes("safe") ? " May mà có két sắt giữ lại một phần!" : " Lẽ ra nên gửi ngân hàng..."}
          </p>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <Icon name="icon_sunrise" className="h-[5em] w-[5em]" />
          </div>
          <h2 className="text-center text-[1.5em] font-extrabold">Chào buổi sáng!</h2>
          <p className="mb-2 text-center text-cocoa">Một đêm yên bình. Quán vẫn nguyên vẹn.</p>
        </>
      )}
      <dl className="divide-y-2 divide-[#efe1cf]">
        {r.deposited > 0 && (
          <div className="flex justify-between py-[0.3em]">
            <dt>Đã gửi ngân hàng (phí {r.fee})</dt>
            <dd className="font-extrabold">
              <Coin value={r.deposited} />
            </dd>
          </div>
        )}
        {r.rent > 0 && (
          <div className="flex justify-between py-[0.3em]">
            <dt>Tiền thuê mặt bằng</dt>
            <dd className="font-extrabold text-berry">-{r.rent}</dd>
          </div>
        )}
        {r.installment > 0 && (
          <div className="flex justify-between py-[0.3em]">
            <dt>Trả góp ngân hàng</dt>
            <dd className="font-extrabold text-berry">-{r.installment}</dd>
          </div>
        )}
        <div className="flex justify-between py-[0.3em]">
          <dt>Tiền mặt · Tiết kiệm</dt>
          <dd className="font-extrabold">
            <Coin value={s.money} /> · <Coin value={s.bank} />
          </dd>
        </div>
      </dl>
      {r.loanPaidOff && <p className="mt-2 text-center font-bold text-[#2f6b2f]">Đã trả hết nợ ngân hàng!</p>}
      {r.overdue > 0 && <p className="mt-2 text-center font-bold text-berry">Không đủ tiền trả {r.overdue} xu hoá đơn...</p>}
      <button className={`btn mt-3 w-full text-[1.2em] ${r.overdue > 0 ? "btn-danger" : "btn-green"}`} onClick={() => game.startMorning()}>
        {r.overdue > 0 ? "Đối mặt sự thật..." : `Bắt đầu ngày ${s.day}`}
      </button>
    </>
  );
}

export function BankruptScreen() {
  const game = useGame();
  const s = game.save;
  const offer = game.loanOffer;
  useEffect(() => audio.play("bad"), []);
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[rgba(30,20,20,0.92)] p-[5%]">
      <section className="panel pop-in max-h-full w-full max-w-[28em] overflow-y-auto p-[1em] text-center">
        <div className="flex justify-center">
          <Icon name={["icon_bankrupt", "icon_bank"]} className="h-[5em] w-[5em]" />
        </div>
        <h2 className="text-[1.6em] font-extrabold text-berry">PHÁ SẢN!</h2>
        <p className="mb-2">
          Quán không còn đủ tiền {s.overdue > 0 ? `trả ${s.overdue} xu hoá đơn` : "để nhập hàng"}. Chủ nhà đã dán giấy niêm phong lên cửa. Cách duy nhất để mở lại là vay ngân hàng.
        </p>
        <div className="mb-3 rounded-2xl border-2 border-[#e9d7c3] bg-white/60 p-2 text-left text-[0.95em]">
          <p className="flex items-center gap-1 font-extrabold">
            <Icon name="icon_bank" /> Khoản vay khẩn cấp
          </p>
          <p>
            Giải ngân: <Coin value={offer.amount} /> {s.overdue > 0 ? `(trả ${s.overdue} xu hoá đơn, còn lại làm vốn)` : ""}
          </p>
          <p>
            Tổng phải trả: <Coin value={offer.total} /> (lãi 25%{s.loan ? ", gộp khoản nợ cũ" : ""})
          </p>
          <p>
            Trả góp: <b>{offer.installment} xu</b> mỗi sáng cho đến khi hết nợ.
          </p>
        </div>
        <button className="btn btn-green w-full text-[1.2em]" onClick={() => game.takeLoan()}>
          Ký hợp đồng vay
        </button>
        <button className="btn btn-secondary mt-2 w-full" onClick={() => game.toMenu()}>
          Về menu
        </button>
      </section>
    </div>
  );
}
