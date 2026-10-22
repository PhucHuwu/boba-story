import { INGREDIENTS, QUESTS, defaultSave } from "./core/data";
import {
  RECOVERY_GRANT,
  buyIngredient,
  buyUpgrade,
  claimQuest,
  needsRecovery,
  refreshQuests,
  unlockRecipe,
  type ShopResult,
} from "./core/economy";
import { clearLocal, cloudDownload, cloudUpload, loadLocal, saveLocal } from "./core/save";
import type { DayStats, IngredientId, SaveData, Settings } from "./core/types";

export type Phase = "loading" | "menu" | "prep" | "open" | "summary";
export type Modal = null | "shop" | "recipes" | "settings" | "quests" | "pause" | "cloud";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "good" | "bad";
}

export interface Hint {
  text: string;
  step: number;
  total: number;
}

export function emptyDayStats(): DayStats {
  return { revenue: 0, tips: 0, rewards: 0, spent: 0, served: 0, lost: 0, qualitySum: 0, perfect: 0, recipesServed: [], ingredientValueUsed: 0 };
}

type Listener = () => void;

/**
 * Single source of truth shared by the React UI and the Phaser scene.
 * Systems change data through these methods; nothing mutates `save` from outside.
 */
class GameStore {
  save: SaveData = defaultSave();
  hasSave = false;
  phase: Phase = "loading";
  modal: Modal = null;
  paused = false;
  /** Seconds elapsed in the current business day. */
  clock = 0;
  closing = false;
  loadProgress = 0;
  dayStats: DayStats = emptyDayStats();
  lastSummary: { day: number; stats: DayStats; profit: number } | null = null;
  toasts: Toast[] = [];
  hint: Hint | null = null;
  cloudBusy = false;

  private version = 0;
  private listeners = new Set<Listener>();
  private toastId = 0;
  /** Scene hooks (set by Phaser). */
  sceneHooks: { onPhase?: (p: Phase) => void; onPause?: (paused: boolean) => void; onSettings?: () => void; endDayNow?: () => void } = {};

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;

  emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  init() {
    const local = loadLocal();
    this.hasSave = !!local;
    if (local) this.save = local;
    if (typeof window !== "undefined" && !local && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.save.settings.reducedMotion = true;
    }
    this.emit();
  }

  setLoadProgress(p: number) {
    this.loadProgress = p;
    if (p >= 1 && this.phase === "loading") this.phase = "menu";
    this.emit();
  }

  // ---------- flow ----------
  newGame() {
    const settings = this.save.settings;
    this.save = defaultSave();
    this.save.settings = settings;
    this.hasSave = true;
    saveLocal(this.save);
    this.toPrep();
  }

  continueGame() {
    this.toPrep();
  }

  toMenu() {
    this.modal = null;
    this.paused = false;
    this.hint = null;
    this.setPhase("menu");
  }

  private toPrep() {
    this.modal = null;
    this.paused = false;
    this.clock = 0;
    this.closing = false;
    this.dayStats = emptyDayStats();
    if (needsRecovery(this.save)) {
      this.save.money += RECOVERY_GRANT;
      this.toast(`Mochi gửi tặng ${RECOVERY_GRANT} xu để quán vượt khó. Hãy nhập ly, nắp và trà nhé!`, "good");
      this.persist();
    }
    this.setPhase("prep");
  }

  openShop() {
    this.dayStats = emptyDayStats();
    this.clock = 0;
    this.closing = false;
    this.modal = null;
    this.setPhase("open");
  }

  /** Called by the scene when the day is over (time is up and the counter is empty, or player closed early). */
  finishDay() {
    const stats = this.dayStats;
    this.save.stats.daysCompleted++;
    const profit = stats.revenue + stats.tips + stats.rewards - stats.ingredientValueUsed;
    this.lastSummary = { day: this.save.day, stats, profit };
    this.save.day++;
    this.checkQuests();
    this.persist();
    void this.cloudSync(true);
    this.hint = null;
    this.modal = null;
    this.paused = false;
    this.setPhase("summary");
  }

  nextDay() {
    this.toPrep();
  }

  requestEndDay() {
    this.modal = null;
    this.setPaused(false);
    this.sceneHooks.endDayNow?.();
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.sceneHooks.onPhase?.(p);
    this.emit();
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    this.sceneHooks.onPause?.(paused);
    this.emit();
  }

  openModal(m: Modal) {
    this.modal = m;
    if (this.phase === "open" && m) this.setPaused(true);
    this.emit();
  }

  closeModal() {
    this.modal = null;
    if (this.phase === "open") this.setPaused(false);
    this.emit();
  }

  // ---------- gameplay ----------
  setClock(sec: number) {
    const before = Math.floor(this.clock / 2);
    this.clock = sec;
    if (Math.floor(sec / 2) !== before) this.emit();
  }

  setClosing(v: boolean) {
    this.closing = v;
    this.emit();
  }

  /** Deducts one unit of stock. Returns false when out of stock. */
  consume = (id: IngredientId): boolean => {
    if (this.save.inventory[id] <= 0) return false;
    this.save.inventory[id]--;
    this.dayStats.ingredientValueUsed += INGREDIENTS[id].unitCost;
    this.emit();
    return true;
  };

  recordServe(p: { price: number; tip: number; reputation: number; quality: number; recipeId: string; archetype: string }) {
    const s = this.dayStats;
    s.revenue += p.price;
    s.tips += p.tip;
    s.served++;
    s.qualitySum += p.quality;
    if (p.quality >= 90) s.perfect++;
    if (!s.recipesServed.includes(p.recipeId)) s.recipesServed.push(p.recipeId);
    this.save.money += p.price + p.tip;
    this.save.reputation = Math.max(0, Math.min(100, this.save.reputation + p.reputation));
    this.save.stats.served++;
    this.save.stats.totalEarned += p.price + p.tip;
    if (p.quality >= 90) this.save.stats.perfect++;
    if (p.archetype === "regular") {
      this.save.stats.regularVisits++;
      this.save.regularStage++;
    }
    if (p.archetype === "picky" && p.quality >= 80) this.save.stats.pickyHappy++;
    this.checkQuests();
    this.emit();
  }

  recordLost(penalty: number) {
    this.dayStats.lost++;
    this.save.reputation = Math.max(0, this.save.reputation + penalty);
    this.emit();
  }

  completeTutorial() {
    this.save.tutorialDone = true;
    this.hint = null;
    this.emit();
  }

  setHint(h: Hint | null) {
    this.hint = h;
    this.emit();
  }

  // ---------- shop ----------
  private afterShop(r: ShopResult, cost: number, okText: string) {
    if (r.ok) {
      this.dayStats.spent += cost;
      this.checkQuests();
      this.persist();
      this.toast(okText, "good");
    } else {
      this.toast(r.reason, "bad");
    }
    this.emit();
    return r.ok;
  }

  buyIngredient(id: IngredientId) {
    const before = this.save.money;
    const r = buyIngredient(this.save, id);
    return this.afterShop(r, before - this.save.money, `Đã nhập ${INGREDIENTS[id].pack} ${INGREDIENTS[id].name}`);
  }

  unlockRecipe(id: string) {
    const before = this.save.money;
    const r = unlockRecipe(this.save, id);
    return this.afterShop(r, before - this.save.money, "Đã mở khóa công thức mới!");
  }

  buyUpgrade(id: string) {
    const before = this.save.money;
    const r = buyUpgrade(this.save, id);
    return this.afterShop(r, before - this.save.money, "Nâng cấp thành công!");
  }

  claimQuest(id: string) {
    const reward = claimQuest(this.save, id);
    if (reward > 0) {
      if (this.phase === "open") this.dayStats.rewards += reward;
      else if (this.lastSummary && this.phase === "summary") {
        this.lastSummary.stats.rewards += reward;
        this.lastSummary.profit += reward;
      }
      this.toast(`Nhận thưởng ${reward} xu!`, "good");
      if (this.phase !== "open") this.persist();
    }
    this.emit();
  }

  checkQuests() {
    for (const id of refreshQuests(this.save)) {
      const q = QUESTS.find((x) => x.id === id);
      if (q) this.toast(`Hoàn thành nhiệm vụ: ${q.title}`, "good");
    }
  }

  // ---------- settings / persistence ----------
  updateSettings(patch: Partial<Settings>) {
    this.save.settings = { ...this.save.settings, ...patch };
    if (this.phase !== "open") saveLocal(this.save);
    this.sceneHooks.onSettings?.();
    this.emit();
  }

  persist() {
    if (!saveLocal(this.save)) this.toast("Không thể lưu vào trình duyệt (bộ nhớ đầy hoặc bị chặn)", "bad");
    this.hasSave = true;
  }

  async cloudSync(silent = false) {
    if (this.cloudBusy) return;
    this.cloudBusy = true;
    this.emit();
    const r = await cloudUpload(this.save);
    this.cloudBusy = false;
    if (!silent || !r.ok) this.toast(r.message, r.ok ? "good" : silent ? "info" : "bad");
    this.emit();
  }

  async cloudRestore(code: string) {
    this.cloudBusy = true;
    this.emit();
    const r = await cloudDownload(code.trim().toUpperCase());
    this.cloudBusy = false;
    if (r.save) {
      this.save = r.save;
      this.hasSave = true;
      saveLocal(this.save);
      this.toast(r.message, "good");
      this.emit();
      return true;
    }
    this.toast(r.message, "bad");
    this.emit();
    return false;
  }

  deleteSave() {
    clearLocal();
    const settings = this.save.settings;
    this.save = defaultSave();
    this.save.settings = settings;
    this.hasSave = false;
    this.toast("Đã xóa dữ liệu lưu", "info");
    this.emit();
  }

  toast(text: string, kind: Toast["kind"] = "info") {
    const id = ++this.toastId;
    this.toasts = [...this.toasts.slice(-3), { id, text, kind }];
    this.emit();
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.emit();
    }, 3200);
  }
}

export const store = new GameStore();
