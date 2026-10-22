import { INGREDIENTS, QUESTS, defaultSave } from "@/domain/catalog";
import {
  RECOVERY_GRANT,
  buyIngredient,
  buyUpgrade,
  claimQuest,
  needsRecovery,
  refreshQuests,
  unlockRecipe,
  type ShopResult,
} from "@/domain/economy";
import { dayProfit, emptyDayStats, recordLost, recordServe, type ServeRecord } from "@/domain/ledger";
import { migrate } from "@/domain/saveSchema";
import type { DayStats, IngredientId, SaveData, Settings } from "@/domain/types";
import { Observable } from "../common/emitter";
import { Notifier, type NoticeKind } from "../common/notifier";
import type { CloudSaveGateway, DialogueGateway, RecoveryCodeStore, Rng, SaveRepository } from "../ports";
import { ShopSession, type ShopHost } from "./shopSession";

export type Phase = "loading" | "menu" | "prep" | "open" | "summary";
export type Modal = null | "shop" | "recipes" | "settings" | "quests" | "pause" | "cloud";

export interface DaySummary {
  day: number;
  stats: DayStats;
  profit: number;
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
    this.toPrep();
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

  nextDay() {
    this.toPrep();
  }

  private toPrep() {
    this.session.reset();
    this.modal = null;
    this.paused = false;
    this.dayStats = emptyDayStats();
    if (needsRecovery(this.save)) {
      this.save.money += RECOVERY_GRANT;
      this.notify(`Mochi gửi tặng ${RECOVERY_GRANT} xu để quán vượt khó. Hãy nhập ly, nắp và trà nhé!`, "good");
      this.persist();
    }
    this.setPhase("prep");
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

  tutorialCompleted() {
    this.save.tutorialDone = true;
    this.persist();
  }

  notify(text: string, kind: NoticeKind = "info") {
    this.notices.push(text, kind);
  }

  dayOver() {
    this.save.stats.daysCompleted++;
    this.lastSummary = { day: this.save.day, stats: this.dayStats, profit: dayProfit(this.dayStats) };
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
