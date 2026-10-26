import { INGREDIENTS, QUESTS, defaultSave } from "@/domain/catalog";
import { goalStatus, planDay, type GoalStatus } from "@/domain/dayPlan";
import {
  buyIngredient,
  buyUpgrade,
  claimQuest,
  needsRecovery,
  refreshQuests,
  unlockRecipe,
  type ShopResult,
} from "@/domain/economy";
import { receiveGift } from "@/domain/guests";
import { LOTTERY_PRICE, STRAY_FEED_REPUTATION, buyLottery, drawLottery, feedStray, hasShopCat, type LotteryResult } from "@/domain/visitors";
import { adjustReputation, dayProfit, emptyDayStats, recordLost, recordServe, type ServeRecord } from "@/domain/ledger";
import { isBankrupt, loanOffer, repayLoan, resolveNight, takeLoan, withdraw, type NightReport } from "@/domain/night";
import { addReview, shopRating } from "@/domain/reviews";
import { FAKE_REVIEW_TEXTS, RIVAL_EVENTS } from "@/domain/rivalEvents";
import { migrate } from "@/domain/saveSchema";
import type { DayStats, IngredientId, Review, RivalEventId, SaveData, Settings } from "@/domain/types";
import { Observable } from "../common/emitter";
import { Notifier, type NoticeKind } from "../common/notifier";
import type { CloudSaveGateway, DialogueGateway, RecoveryCodeStore, Rng, SaveRepository } from "../ports";
import { ShopSession, type ReviewDraft, type ShopHost } from "./shopSession";

export type Phase = "loading" | "menu" | "prep" | "open" | "summary" | "night" | "bankrupt";
export type Modal = null | "shop" | "recipes" | "settings" | "quests" | "pause" | "cloud" | "reviews" | "bank" | "rival";

export interface DaySummary {
  day: number;
  stats: DayStats;
  profit: number;
  goal: GoalStatus | null;
  goalReward: number;
  reviews: Review[];
  /** Lottery ticket drawn at closing (prize already added to cash, not to the day profit). */
  lottery: LotteryResult | null;
}

export interface GameDeps {
  saves: SaveRepository;
  cloud: CloudSaveGateway;
  recoveryCode: RecoveryCodeStore;
  dialogue: DialogueGateway;
  rng: Rng;
  prefersReducedMotion: () => boolean;
}

/**
 * Application facade for the whole game: flow between screens, shop, quests, settings and saves.
 * UI (React) and the scene (Phaser) only call these methods and read state; neither mutates `save`.
 */
export class GameController extends Observable implements ShopHost {
  save: SaveData = defaultSave();
  hasSave = false;
  phase: Phase = "loading";
  modal: Modal = null;
  paused = false;
  loadProgress = 0;
  dayStats: DayStats = emptyDayStats();
  lastSummary: DaySummary | null = null;
  cloudBusy = false;
  /** Rival event waiting for the player's choice. */
  rivalEvent: RivalEventId | null = null;
  /** Result of the last resolved night (shown on the morning screen). */
  lastNight: NightReport | null = null;

  readonly notices = new Notifier(() => this.changed());
  readonly session: ShopSession;

  constructor(private readonly deps: GameDeps) {
    super();
    this.session = new ShopSession(this, { rng: deps.rng, dialogue: deps.dialogue });
  }

  init() {
    const local = this.deps.saves.load();
    this.hasSave = !!local;
    if (local) this.save = local;
    else if (this.deps.prefersReducedMotion()) this.save.settings.reducedMotion = true;
    this.changed();
  }

  get recoveryCode() {
    return this.deps.recoveryCode.get();
  }

  setLoadProgress(p: number) {
    this.loadProgress = p;
    if (p >= 1 && this.phase === "loading") this.phase = "menu";
    this.changed();
  }

  // ---------------------------------------------------------------- flow
  newGame() {
    const settings = this.save.settings;
    this.save = defaultSave();
    this.save.settings = settings;
    this.persist();
    this.toPrep();
  }

  continueGame() {
    if (this.save.nightPending) this.toNight();
    else this.toPrep();
  }

  toMenu() {
    this.session.reset();
    this.modal = null;
    this.paused = false;
    this.setPhase("menu");
  }

  openShop() {
    this.dayStats = emptyDayStats();
    this.modal = null;
    this.paused = false;
    this.setPhase("open");
    this.session.start();
  }

  requestEndDay() {
    this.modal = null;
    this.paused = false;
    this.session.endNow();
    this.changed();
  }

  /** Summary → night: decide how much cash to bank before going home. */
  nextDay() {
    this.toNight();
  }

  private toNight() {
    this.session.reset();
    this.modal = null;
    this.paused = false;
    this.lastNight = null;
    this.setPhase("night");
  }

  /** Ends the night: deposit, robbery roll, morning bills. Persisted at once so a reload cannot reroll it. */
  endNight(depositAmount: number) {
    if (this.phase !== "night" || this.lastNight) return;
    this.lastNight = resolveNight(this.save, this.save.day - 1, depositAmount, this.deps.rng);
    this.save.nightPending = false;
    this.persist();
    this.changed();
  }

  /** Morning screen → prep (or the bankruptcy screen). */
  startMorning() {
    this.lastNight = null;
    this.toPrep();
  }

  get bankrupt() {
    return isBankrupt(this.save);
  }

  get loanOffer() {
    return loanOffer(this.save);
  }

  takeLoan() {
    if (this.phase !== "bankrupt") return;
    const loan = takeLoan(this.save);
    this.notify(`Ngân hàng giải ngân! Trả góp ${loan.installment} xu mỗi sáng, còn nợ ${loan.remaining} xu.`, "good");
    this.persist();
    this.toPrep();
  }

  private toPrep() {
    this.session.reset();
    this.modal = null;
    this.paused = false;
    this.dayStats = emptyDayStats();
    if (this.bankrupt) return this.setPhase("bankrupt");
    if (needsRecovery(this.save) && this.save.bank > 0) this.notify("Hết vốn trong quầy — hãy rút tiền tiết kiệm ở Ngân hàng để nhập hàng.", "info");
    if (!this.save.plan || this.save.plan.day !== this.save.day) {
      this.save.plan = planDay(this.save, this.deps.rng, this.rating);
      this.persist();
    }
    this.setPhase("prep");
  }

  get rating() {
    return shopRating(this.save.reviews);
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.changed();
  }

  /** The simulation advances only while this is true. */
  get running() {
    return this.phase === "open" && !this.paused;
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.session.stopPour();
    this.changed();
  }

  openModal(m: Exclude<Modal, null>) {
    this.modal = m;
    if (this.phase === "open") this.setPaused(true);
    this.changed();
  }

  closeModal() {
    this.modal = null;
    if (this.phase === "open") this.setPaused(false);
    this.changed();
  }

  // ---------------------------------------------------------------- ShopHost (called by the session)
  isInteractive() {
    return this.running && !this.modal;
  }

  consume = (id: IngredientId): boolean => {
    if (this.save.inventory[id] <= 0) return false;
    this.save.inventory[id]--;
    this.dayStats.ingredientValueUsed += INGREDIENTS[id].unitCost;
    this.changed();
    return true;
  };

  served(record: ServeRecord) {
    recordServe(this.save, this.dayStats, record);
    this.checkQuests();
    this.changed();
  }

  lost(reputationPenalty: number) {
    recordLost(this.save, this.dayStats, reputationPenalty);
    this.changed();
  }

  reviewed(draft: ReviewDraft): number {
    const id = this.save.nextReviewId++;
    this.save.reviews = addReview(this.save.reviews, { id, day: this.save.day, ...draft, ...(draft.critic ? { critic: true } : {}) });
    this.dayStats.starsSum += draft.stars;
    this.dayStats.reviews++;
    if (draft.stars === 5) this.save.stats.fiveStars++;
    this.checkQuests();
    this.changed();
    return id;
  }

  adjustReputation(delta: number) {
    adjustReputation(this.save, delta);
    this.changed();
  }

  gift(id: IngredientId, amount: number): number {
    const added = receiveGift(this.save.inventory, id, amount);
    this.changed();
    return added;
  }

  reviseReview(id: number, text: string) {
    const r = this.save.reviews.find((x) => x.id === id);
    if (!r) return;
    r.text = text.slice(0, 160);
    this.changed();
  }

  rivalStrikes(id: RivalEventId) {
    const def = RIVAL_EVENTS[id];
    this.session.applyEffects(def.immediate);
    for (const e of def.immediate) if (e.kind === "fakeReviews") this.addFakeReviews(e.count);
    this.rivalEvent = id;
    this.openModal("rival");
  }

  private addFakeReviews(count: number) {
    for (let i = 0; i < count; i++) {
      const id = this.save.nextReviewId++;
      const text = FAKE_REVIEW_TEXTS[i % FAKE_REVIEW_TEXTS.length];
      this.save.reviews = addReview(this.save.reviews, { id, day: this.save.day, stars: 1, text, archetype: "office", fake: true });
    }
  }

  /** Player answers the rival event with option `index`. Returns false when it cannot be afforded. */
  chooseRival(index: number): boolean {
    const id = this.rivalEvent;
    if (!id) return false;
    const option = RIVAL_EVENTS[id].options[index];
    if (!option) return false;
    if (this.save.money < option.cost) {
      this.notify("Không đủ xu cho lựa chọn này", "bad");
      return false;
    }
    const out = option.resolve(this.deps.rng);
    this.save.money -= out.cost;
    this.dayStats.otherCosts += out.cost;
    this.save.reputation = Math.max(0, Math.min(100, this.save.reputation + out.reputation));
    for (const e of out.effects) if (e.kind === "fakeReviews" && e.count === 0) this.save.reviews = this.save.reviews.filter((r) => !(r.fake && r.day === this.save.day));
    this.session.applyEffects(out.effects.filter((e) => e.kind !== "fakeReviews"));
    if (out.win) this.save.stats.rivalsBeaten++;
    this.dayStats.rivalOutcome = out.message;
    this.notify(out.message, out.win ? "good" : out.reputation < 0 ? "bad" : "info");
    this.rivalEvent = null;
    this.checkQuests();
    this.closeModal();
    return true;
  }

  tutorialCompleted() {
    this.save.tutorialDone = true;
    this.persist();
  }

  notify(text: string, kind: NoticeKind = "info") {
    this.notices.push(text, kind);
  }

  dayOver() {
    this.save.stats.daysCompleted++;
    const plan = this.save.plan?.day === this.save.day ? this.save.plan : null;
    const goal = plan ? goalStatus(plan.goal, this.dayStats) : null;
    if (plan && goal?.met) {
      this.dayStats.goalMet = true;
      this.dayStats.goalReward = plan.goal.reward;
      this.save.money += plan.goal.reward;
      this.save.stats.goalsMet++;
    }
    let lottery: LotteryResult | null = null;
    if (this.save.lotteryDay === this.save.day) {
      lottery = drawLottery(this.deps.rng);
      this.save.money += lottery.amount;
      this.save.lotteryDay = 0;
    }
    this.lastSummary = {
      day: this.save.day,
      stats: this.dayStats,
      profit: dayProfit(this.dayStats),
      goal,
      goalReward: this.dayStats.goalReward,
      reviews: this.save.reviews.filter((r) => r.day === this.save.day),
      lottery,
    };
    this.rivalEvent = null;
    this.save.nightPending = true;
    this.save.day++;
    this.checkQuests();
    this.persist();
    void this.cloudSync(true);
    this.modal = null;
    this.paused = false;
    this.setPhase("summary");
  }

  // `changed` is protected on Observable; ShopHost needs it public.
  override changed() {
    super.changed();
  }

  // ---------------------------------------------------------------- shop
  private afterPurchase(r: ShopResult, cost: number, okText: string) {
    if (r.ok) {
      this.dayStats.spent += cost;
      this.checkQuests();
      this.persist();
      this.notify(okText, "good");
    } else this.notify(r.reason, "bad");
    this.changed();
    return r.ok;
  }

  buyIngredient(id: IngredientId) {
    const before = this.save.money;
    const r = buyIngredient(this.save, id);
    return this.afterPurchase(r, before - this.save.money, `Đã nhập ${INGREDIENTS[id].pack} ${INGREDIENTS[id].name}`);
  }

  unlockRecipe(id: string) {
    const before = this.save.money;
    return this.afterPurchase(unlockRecipe(this.save, id), before - this.save.money, "Đã mở khóa công thức mới!");
  }

  buyUpgrade(id: string) {
    const before = this.save.money;
    return this.afterPurchase(buyUpgrade(this.save, id), before - this.save.money, "Nâng cấp thành công!");
  }

  withdraw(amount: number) {
    withdraw(this.save, amount);
    this.persist();
    this.changed();
  }

  repayLoan(amount: number) {
    const paid = repayLoan(this.save, amount);
    if (paid > 0) this.notify(this.save.loan ? `Đã trả ${paid} xu nợ` : "Đã trả hết nợ ngân hàng!", "good");
    this.persist();
    this.changed();
  }

  /** Morning visitor: buy one lottery ticket, drawn when the shop closes tonight. */
  buyLottery() {
    if (this.phase !== "prep" || !buyLottery(this.save)) return;
    this.notify(`Đã mua vé số ${LOTTERY_PRICE} xu. Tối nay đóng cửa sẽ dò kết quả!`, "info");
    this.persist();
    this.changed();
  }

  /** Morning visitor: give the stray kitten a saucer of milk. */
  feedStray() {
    if (this.phase !== "prep" || !feedStray(this.save)) return;
    this.notify(hasShopCat(this.save) ? "Mèo hoang nhỏ quyết định ở lại làm mèo của quán! Khách qua đường thích ghé hơn." : `Mèo hoang nhỏ uống sữa ngon lành (+${STRAY_FEED_REPUTATION} danh tiếng).`, "good");
    this.persist();
    this.changed();
  }

  /** Morning visitor: send them away (nothing happens). */
  dismissVisitor() {
    const plan = this.save.plan;
    if (this.phase !== "prep" || !plan?.visitor || plan.visitorDone) return;
    plan.visitorDone = true;
    this.persist();
    this.changed();
  }

  claimQuest(id: string) {
    const reward = claimQuest(this.save, id);
    if (reward <= 0) return;
    if (this.phase === "open") this.dayStats.rewards += reward;
    else if (this.phase === "summary" && this.lastSummary) {
      this.lastSummary.stats.rewards += reward;
      this.lastSummary.profit += reward;
    }
    this.notify(`Nhận thưởng ${reward} xu!`, "good");
    this.persist();
    this.changed();
  }

  private checkQuests() {
    for (const id of refreshQuests(this.save)) {
      const q = QUESTS.find((x) => x.id === id);
      if (q) this.notify(`Hoàn thành nhiệm vụ: ${q.title}`, "good");
    }
  }

  // ---------------------------------------------------------------- settings & persistence
  updateSettings(patch: Partial<Settings>) {
    this.save.settings = { ...this.save.settings, ...patch };
    this.persist();
    this.changed();
  }

  private persist() {
    if (!this.deps.saves.save(this.save)) this.notify("Không thể lưu vào trình duyệt (bộ nhớ đầy hoặc bị chặn)", "bad");
    this.hasSave = true;
  }

  deleteSave() {
    this.deps.saves.clear();
    const settings = this.save.settings;
    this.save = defaultSave();
    this.save.settings = settings;
    this.hasSave = false;
    this.notify("Đã xóa dữ liệu lưu", "info");
    this.changed();
  }

  async cloudSync(silent = false) {
    if (this.cloudBusy) return;
    this.cloudBusy = true;
    this.changed();
    const r = await this.deps.cloud.upload(this.recoveryCode, this.save);
    this.cloudBusy = false;
    if (r.ok) {
      if (!silent) this.notify("Đã lưu lên đám mây", "good");
    } else this.notify(r.message, silent ? "info" : "bad");
    this.changed();
  }

  async cloudRestore(code: string): Promise<boolean> {
    this.cloudBusy = true;
    this.changed();
    const r = await this.deps.cloud.download(code);
    this.cloudBusy = false;
    const data = r.ok ? migrate(r.value) : null;
    if (!data) {
      this.notify(r.ok ? "Bản lưu bị lỗi" : r.message, "bad");
      this.changed();
      return false;
    }
    this.save = data;
    this.deps.recoveryCode.set(code);
    this.persist();
    this.notify("Đã tải bản lưu", "good");
    this.changed();
    return true;
  }
}
