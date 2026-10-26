import { ARCHETYPES, DAY, FALLBACK_LINES, REGULAR_LINES } from "@/domain/catalog";
import { addIce, addSugar, addTopping, liquidTotal, newCup, pour, seal, shake, type ActionResult } from "@/domain/cup";
import {
  chooseArchetype,
  createCustomer,
  createOrder,
  hourAt,
  isImpatient,
  maxCustomers,
  spawnInterval,
  tickPatience,
  transition,
  type Customer,
} from "@/domain/customers";
import { COMBO_QUALITY, CRITIC_CHANCE, CRITIC_FROM_DAY, WEATHER, comboTipBonus } from "@/domain/dayPlan";
import { SHIPPER_BRANDS, SHIPPER_CHANCE, SHIPPER_FROM_DAY, createDelivery, splitCommission } from "@/domain/delivery";
import { SHOP_CAT_SPAWN_MUL, hasShopCat } from "@/domain/visitors";
import { GRANNY_GIFT, GRANNY_HAPPY_QUALITY, TIKTOKER_WALKOUT_REPUTATION, pickGuest, tiktokerVerdict, type GuestId } from "@/domain/guests";
import { LEAVE_REPUTATION_PENALTY, canMake, payment } from "@/domain/economy";
import type { ServeRecord } from "@/domain/ledger";
import { evaluate, grade } from "@/domain/quality";
import { ratingSpawnFactor, shopRating, writeReview } from "@/domain/reviews";
import { TRASH_TEXTS, type Effect } from "@/domain/rivalEvents";
import type { ArchetypeId, CupState, IngredientId, Mood, Order, RivalEventId, SaveData, ShipperBrand, Size, TeaId, ToppingId } from "@/domain/types";
import { Emitter } from "../common/emitter";
import type { NoticeKind } from "../common/notifier";
import type { DialogueEvent, DialogueGateway, Rng } from "../ports";
import { rejectionMessage } from "./messages";
import { tutorialHint, type Hint } from "./tutorial";

export type PourSource = TeaId | "milk";

/** Durations (seconds) the simulation uses; views animate with the values sent in events. */
export const TIMING = {
  walkIn: 2,
  walkOut: 1.8,
  reducedWalk: 0.5,
  receive: 1.7,
  giveUp: 0.9,
  seal: 0.45,
  shake: 0.9,
  sealFast: 0.12,
} as const;

const POUR_RATE = 0.36;
const FAST_TAP_MUL = 1.4;
const TUTORIAL_ORDER: Omit<Order, "id"> = { recipeId: "boba", size: "M", sugar: 50, ice: 50 };

export interface ShopCustomer {
  readonly data: Customer;
  mood: Mood;
  /** Seconds left in a timed state (approaching, receiving, leaving). */
  timer: number;
}

export interface ServedInfo {
  recipeId: string;
  quality: number;
  stars: number;
  label: string;
  price: number;
  tip: number;
  happy: boolean;
}

export type ShopEvent =
  | { type: "reset" }
  | { type: "arrived"; customer: ShopCustomer; duration: number }
  | { type: "ordering"; id: number }
  | { type: "leaving"; id: number; delay: number; duration: number }
  | { type: "gone"; id: number }
  | { type: "mood"; id: number; mood: Mood }
  | { type: "say"; id: number; text: string }
  | { type: "selected"; id: number | null }
  | { type: "served"; id: number; info: ServedInfo }
  | { type: "cup"; action: "take" | "sugar" | "ice" | "topping" | "shakeStart" | "shaken" | "sealStart" | "sealed" | "discard"; duration?: number }
  | { type: "rejected" }
  | { type: "closing" }
  | { type: "review"; id: number; stars: number; text: string }
  | { type: "combo"; count: number }
  | { type: "trash"; items: TrashItem[] }
  | { type: "rival"; id: RivalEventId }
  /** A shipper got one cup and now waits for the next one in the same delivery. */
  | { type: "nextCup"; id: number };

export interface TrashItem {
  id: number;
  /** Position as fractions of the customer room (0..1), so every layout can place it. */
  x: number;
  y: number;
  kind: number;
}

export interface ReviewDraft {
  stars: number;
  text: string;
  archetype: ArchetypeId;
  critic: boolean;
}

type TimedKind = "priceMul" | "spawnMul" | "decayMul" | "pourMul";

/** Narrow view of the game the shop simulation needs (Interface Segregation). */
export interface ShopHost {
  readonly save: SaveData;
  isInteractive(): boolean;
  consume(id: IngredientId): boolean;
  served(record: ServeRecord): void;
  lost(reputationPenalty: number): void;
  /** Stores a customer review; returns its id so an AI rewrite can replace the text later. */
  reviewed(review: ReviewDraft): number;
  reviseReview(id: number, text: string): void;
  /** Special guests: reputation swing outside a normal sale. */
  adjustReputation(delta: number): void;
  /** Adds a gift to the stock (capped); returns how much was added. */
  gift(id: IngredientId, amount: number): number;
  /** The rival strikes: the host shows the choice and later calls `applyEffects`. */
  rivalStrikes(id: RivalEventId): void;
  tutorialCompleted(): void;
  notify(text: string, kind: NoticeKind): void;
  /** Coarse change that the HUD should re-render for (clock, hint, stock). */
  changed(): void;
  dayOver(): void;
}

/**
 * Use case: running one business day at the counter.
 * Owns customers, the cup being brewed, the clock and the tutorial. Framework-free:
 * the view calls commands, calls `tick(dt)` every frame and animates `events`.
 */
export class ShopSession {
  readonly events = new Emitter<ShopEvent>();
  customers: ShopCustomer[] = [];
  cup: CupState | null = null;
  selectedId: number | null = null;
  pouring: PourSource | null = null;
  sealing = false;
  shaking = false;
  clock = 0;
  closing = false;
  hint: Hint | null = null;
  combo = 0;
  trash: TrashItem[] = [];
  rivalFired = false;

  private active = false;
  private timed = new Map<TimedKind, { value: number; left: number }>();
  private malus: { chance: number; texts: string[]; left: number } | null = null;
  private nextTrashId = 1;
  private nextId = 1;
  private spawnTimer = 0;
  private sealTimer = 0;
  private shakeTimer = 0;
  private regularServedToday = false;
  /** Special guests who already came today (each visits at most once a day). */
  private guestsSeen: GuestId[] = [];

  constructor(
    private readonly host: ShopHost,
    private readonly deps: { rng: Rng; dialogue: DialogueGateway },
  ) {}

  // ------------------------------------------------------------ lifecycle
  start() {
    this.reset();
    this.active = true;
    this.spawnTimer = this.spawnEvery - 2.5;
  }

  reset() {
    this.active = false;
    this.customers = [];
    this.cup = null;
    this.selectedId = null;
    this.pouring = null;
    this.sealing = false;
    this.shaking = false;
    this.clock = 0;
    this.closing = false;
    this.hint = null;
    this.regularServedToday = false;
    this.guestsSeen = [];
    this.combo = 0;
    this.trash = [];
    this.rivalFired = false;
    this.timed.clear();
    this.malus = null;
    this.events.emit({ type: "reset" });
  }

  /** Closes the shop now: waiting customers leave, the day ends once the counter is empty. */
  endNow() {
    if (!this.active) return;
    this.clock = DAY.lengthSec;
    this.setClosing();
    for (const c of [...this.customers]) if (c.data.state === "approaching" || c.data.state === "ordering" || c.data.state === "waiting") this.leave(c, 0);
  }

  get hour() {
    return hourAt(this.clock);
  }

  private get save() {
    return this.host.save;
  }

  get weather() {
    const plan = this.save.plan;
    return WEATHER[plan && plan.day === this.save.day ? plan.weather : "sunny"];
  }

  /** Current value of a timed modifier (1 when none). */
  mod(kind: TimedKind): number {
    return this.timed.get(kind)?.value ?? 1;
  }

  /** Seconds between arrivals right now: time of day, reputation, weather, rating, rival and rubbish. */
  get spawnEvery(): number {
    const base = spawnInterval(this.hour, this.save.reputation, this.save.day);
    return base * this.weather.spawnMul * ratingSpawnFactor(shopRating(this.save.reviews)) * this.mod("spawnMul") * this.shopCatMul * (1 + this.trash.length * 0.05);
  }

  /** The adopted shop cat makes passers-by stop a little more often. */
  private get shopCatMul() {
    return hasShopCat(this.save) ? SHOP_CAT_SPAWN_MUL : 1;
  }

  get decayMul(): number {
    return this.weather.decayMul * this.mod("decayMul");
  }

  private get tutorial() {
    return !this.save.tutorialDone;
  }

  private walk(full: number) {
    return this.save.settings.reducedMotion ? TIMING.reducedWalk : full;
  }

  // ------------------------------------------------------------ simulation
  tick(dtSec: number) {
    if (!this.active) return;
    const dt = Math.min(dtSec, 0.1);
    this.tickClock(dt);
    this.tickSpawning();
    this.spawnTimer += dt;
    for (const c of [...this.customers]) this.tickCustomer(c, dt);
    this.tickEffects(dt);
    this.tickRival();
    this.tickPour(dt);
    this.tickShake(dt);
    this.tickSeal(dt);
    if (this.tutorial) this.updateHint();
    if (this.closing && this.customers.length === 0) {
      this.cup = null;
      this.active = false;
      this.host.dayOver();
    }
  }

  private tickClock(dt: number) {
    if (this.closing) return;
    const before = Math.floor(this.clock / 2);
    this.clock = Math.min(this.clock + dt, DAY.lengthSec);
    if (this.clock >= DAY.lengthSec) {
      this.setClosing();
      this.host.notify("Đã đến giờ đóng cửa — phục vụ nốt các mèo khách còn lại nhé!", "info");
    } else if (Math.floor(this.clock / 2) !== before) this.host.changed();
  }

  private setClosing() {
    if (this.closing) return;
    this.closing = true;
    this.events.emit({ type: "closing" });
    this.host.changed();
  }

  private tickSpawning() {
    if (this.closing) return;
    const interval = this.spawnEvery;
    const limit = this.tutorial ? 1 : maxCustomers(this.save);
    const active = this.customers.filter((c) => c.data.state !== "leaving").length;
    if (this.spawnTimer < interval || active >= limit) return;
    if (this.tutorial && this.customers.length > 0) return;
    this.spawnTimer = 0;
    this.spawn();
  }

  private tickCustomer(c: ShopCustomer, dt: number) {
    const d = c.data;
    switch (d.state) {
      case "approaching":
        c.timer -= dt;
        if (c.timer <= 0 && transition(d, "ordering")) {
          this.events.emit({ type: "ordering", id: d.id });
          this.say(c, d.line);
          void this.enrichLine(c, "order");
        }
        break;
      case "ordering":
      case "waiting":
        if (this.tutorial) break;
        if (tickPatience(d, dt * this.decayMul, this.save.settings.relaxed)) this.giveUp(c);
        else this.setMood(c, isImpatient(d) || (d.state === "ordering" && d.patience < 35) ? "impatient" : "idle");
        break;
      case "receiving":
        c.timer -= dt;
        if (c.timer <= 0) this.leave(c, 0);
        break;
      case "leaving":
        c.timer -= dt;
        if (c.timer <= 0) {
          transition(d, "gone");
          this.customers = this.customers.filter((x) => x !== c);
          this.events.emit({ type: "gone", id: d.id });
        }
        break;
    }
  }

  private tickPour(dt: number) {
    if (!this.pouring) return;
    if (!this.cup) {
      this.pouring = null;
      return;
    }
    const rate = POUR_RATE * (this.save.upgrades.includes("fast_tap") ? FAST_TAP_MUL : 1) * this.mod("pourMul");
    const source = this.pouring;
    const r = pour(this.cup, source, rate * dt, this.host.consume);
    if (!r.ok) {
      this.pouring = null;
      this.reject(r, source);
    }
  }

  private tickShake(dt: number) {
    if (!this.shaking) return;
    this.shakeTimer -= dt;
    if (this.shakeTimer > 0) return;
    this.shaking = false;
    if (!this.cup || !shake(this.cup).ok) return;
    this.events.emit({ type: "cup", action: "shaken" });
  }

  private tickSeal(dt: number) {
    if (!this.sealing) return;
    this.sealTimer -= dt;
    if (this.sealTimer > 0) return;
    this.sealing = false;
    if (!this.cup) return;
    const r = seal(this.cup, this.host.consume);
    if (!r.ok) return this.reject(r, "lid");
    this.events.emit({ type: "cup", action: "sealed" });
  }

  // ------------------------------------------------------------ customers
  private spawn() {
    const slots = maxCustomers(this.save);
    const used = new Set(this.customers.map((c) => c.data.slot));
    const free = Array.from({ length: slots }, (_, i) => i).filter((i) => !used.has(i));
    if (!free.length) return;
    const { rng } = this.deps;
    const slot = free[Math.floor(rng() * free.length)];
    const id = this.nextId++;
    const shipper = this.wantsShipper();
    const guest = this.tutorial || shipper ? null : pickGuest(rng, this.save.day, this.save.reputation, this.guestsSeen);
    if (guest) this.guestsSeen.push(guest);
    const archetype: ArchetypeId = this.tutorial
      ? "regular"
      : shipper
        ? "shipper"
        : guest
          ? guest
        : chooseArchetype(rng, this.save, this.regularServedToday, this.customers.map((c) => c.data.archetype));
    const makeable = this.save.unlockedRecipes.filter((r) => canMake(this.save, r));
    const order = this.tutorial ? { id, ...TUTORIAL_ORDER } : createOrder({ rng, save: this.save, archetype, id, makeable, iceLevels: this.weather.ice });
    const line =
      archetype === "regular"
        ? REGULAR_LINES[Math.min(this.save.regularStage, REGULAR_LINES.length - 1)]
        : FALLBACK_LINES[archetype][Math.floor(rng() * FALLBACK_LINES[archetype].length)];
    if (archetype === "regular") this.regularServedToday = true;
    const duration = this.walk(TIMING.walkIn);
    const customer: ShopCustomer = { data: createCustomer(id, archetype, order, slot, this.save.upgrades, line), mood: "idle", timer: duration };
    if (shipper) {
      const brands = Object.keys(SHIPPER_BRANDS) as ShipperBrand[];
      const brand = brands[Math.floor(rng() * brands.length) % brands.length];
      const count = rng() < 0.5 ? 2 : 3;
      const orders = [order, ...Array.from({ length: count - 1 }, () => createOrder({ rng, save: this.save, archetype, id, makeable, iceLevels: this.weather.ice }))];
      customer.data.delivery = createDelivery(brand, orders);
      customer.data.line = `${SHIPPER_BRANDS[brand].name} tới lấy đơn ${count} ly nè chủ quán!`;
      this.host.notify(`Mèo shipper ${SHIPPER_BRANDS[brand].name} đến lấy đơn ${count} ly. App giữ 20% tiền mỗi ly.`, "info");
    } else if (guest === "granny") {
      this.host.notify("Bà cụ hàng xóm ghé quán. Bà không vội, làm ít ngọt ít đá nha.", "info");
    } else if (guest === "tiktoker") {
      this.host.notify("Mèo TikToker đang livestream! Ly ngon sẽ lên xu hướng, ly dở sẽ bị chê trước cả nghìn người.", "info");
    } else if (!this.tutorial && archetype !== "regular" && this.save.day >= CRITIC_FROM_DAY && rng() < CRITIC_CHANCE) {
      customer.data.critic = true;
      customer.data.line = "Tôi là food reviewer. Hãy cho tôi thấy quán có gì đặc biệt.";
      this.host.notify("Một mèo food reviewer vừa bước vào! Đánh giá của họ nặng gấp 3.", "info");
    }
    this.customers.push(customer);
    this.events.emit({ type: "arrived", customer, duration });
  }

  /** At most one shipper at a time, from SHIPPER_FROM_DAY on. */
  private wantsShipper(): boolean {
    if (this.tutorial || this.save.day < SHIPPER_FROM_DAY || this.customers.some((c) => c.data.delivery)) return false;
    return this.deps.rng() < SHIPPER_CHANCE;
  }

  private leave(c: ShopCustomer, delay: number) {
    if (!transition(c.data, "leaving")) return;
    const duration = this.walk(TIMING.walkOut);
    c.timer = delay + duration;
    this.events.emit({ type: "leaving", id: c.data.id, delay, duration });
    if (this.selectedId === c.data.id) this.selectNext();
  }

  private giveUp(c: ShopCustomer) {
    c.data.cancelled = true;
    this.setMood(c, "sad");
    this.say(c, "Lâu quá... tớ đi đây.");
    this.host.lost(this.save.settings.relaxed ? 0 : LEAVE_REPUTATION_PENALTY);
    if (c.data.archetype === "tiktoker" && !this.save.settings.relaxed) {
      this.host.adjustReputation(TIKTOKER_WALKOUT_REPUTATION);
      this.host.notify("Mèo TikToker bỏ về và đăng video chê quán chậm. Danh tiếng giảm!", "bad");
    }
    this.host.notify(`${ARCHETYPES[c.data.archetype].name} đã bỏ về vì chờ quá lâu`, "bad");
    this.breakCombo();
    this.review(c, null);
    this.leave(c, TIMING.giveUp);
  }

  private setMood(c: ShopCustomer, mood: Mood) {
    if (c.mood === mood) return;
    c.mood = mood;
    this.events.emit({ type: "mood", id: c.data.id, mood });
  }

  private say(c: ShopCustomer, text: string) {
    this.events.emit({ type: "say", id: c.data.id, text });
  }

  /** Shows the fixed line immediately, then swaps in an AI line if one arrives while relevant. */
  private async enrichLine(c: ShopCustomer, event: DialogueEvent) {
    const text = await this.deps.dialogue
      .line({ archetype: c.data.archetype, event, recipeId: c.data.order.recipeId, stage: this.save.regularStage })
      .catch(() => null);
    if (text && this.customers.includes(c) && c.data.state !== "leaving") this.say(c, text);
  }

  private find(id: number | null) {
    return this.customers.find((c) => c.data.id === id);
  }

  get selectedOrder(): Order | undefined {
    return this.find(this.selectedId)?.data.order;
  }

  private select(id: number | null) {
    this.selectedId = id;
    this.events.emit({ type: "selected", id });
  }

  private selectNext() {
    const next = this.customers.find((c) => c.data.state === "waiting" && c.data.id !== this.selectedId);
    this.select(next ? next.data.id : null);
  }

  // ------------------------------------------------------------ commands (player input)
  private canAct() {
    return this.active && this.host.isInteractive();
  }

  tapCustomer(id: number) {
    const c = this.find(id);
    if (!c || !this.canAct()) return;
    const d = c.data;
    if (d.state === "ordering") {
      transition(d, "waiting");
      d.patience = Math.min(100, d.patience + 10);
      this.select(d.id);
    } else if (d.state === "waiting") {
      if (this.cup?.sealed) this.deliver(id);
      else this.select(d.id);
    }
  }

  takeCup(size: Size) {
    if (!this.canAct()) return;
    if (this.cup) return this.fail("Đã có ly trên bàn — hãy giao hoặc bỏ ly vào thùng rác");
    if (!this.host.consume("cup")) return this.fail("Hết ly — hãy nhập thêm ở cửa hàng");
    this.cup = newCup(size);
    this.events.emit({ type: "cup", action: "take" });
  }

  startPour(source: PourSource) {
    if (!this.canAct() || !this.requireCup() || this.shaking) return;
    this.pouring = source;
  }

  stopPour() {
    this.pouring = null;
  }

  pumpSugar() {
    this.discrete("sugar", (cup) => addSugar(cup, this.host.consume));
  }

  scoopIce() {
    this.discrete("ice", (cup) => addIce(cup, this.host.consume));
  }

  addTopping(t: ToppingId) {
    this.discrete("topping", (cup) => addTopping(cup, t, this.host.consume), t);
  }

  private discrete(action: "sugar" | "ice" | "topping", run: (cup: CupState) => ActionResult, stock?: IngredientId) {
    if (!this.canAct() || !this.requireCup() || !this.cup) return;
    const r = run(this.cup);
    if (!r.ok) return this.reject(r, stock ?? action);
    this.events.emit({ type: "cup", action });
  }

  /** Shaking takes a moment, like sealing; recipes marked `shake` lose process points without it. */
  shakeCup() {
    if (!this.canAct() || !this.requireCup() || !this.cup || this.shaking || this.sealing) return;
    if (this.cup.sealed) return this.reject({ ok: false, reason: "sealed" }, "lid");
    if (this.cup.shaken) return this.fail("Ly đã lắc rồi");
    if (liquidTotal(this.cup) < 0.2) return this.fail("Ly còn trống — hãy rót trà trước khi lắc");
    this.stopPour();
    this.shaking = true;
    this.shakeTimer = TIMING.shake;
    this.events.emit({ type: "cup", action: "shakeStart", duration: this.shakeTimer });
  }

  sealCup() {
    if (!this.canAct() || !this.requireCup() || !this.cup || this.sealing || this.shaking) return;
    if (this.cup.sealed) return this.reject({ ok: false, reason: "sealed" }, "lid");
    if (liquidTotal(this.cup) < 0.2) return this.fail("Ly còn trống — hãy rót trà trước khi dán nắp");
    if (this.cup.overflow) this.host.notify("Ly bị tràn — khách sẽ không hài lòng lắm", "info");
    this.sealing = true;
    this.sealTimer = this.save.upgrades.includes("auto_sealer") ? TIMING.sealFast : TIMING.seal;
    this.events.emit({ type: "cup", action: "sealStart", duration: this.sealTimer });
  }

  discardCup() {
    if (!this.canAct() || !this.cup) return;
    this.cup = null;
    this.pouring = null;
    this.sealing = false;
    this.shaking = false;
    this.host.notify("Đã bỏ ly. Lấy ly mới để làm lại.", "info");
    this.events.emit({ type: "cup", action: "discard" });
  }

  deliverToSelected() {
    if (this.selectedId === null) {
      this.host.notify("Kéo ly đến mèo khách, hoặc chạm vào mèo để giao", "info");
      return;
    }
    this.deliver(this.selectedId);
  }

  deliver(id: number) {
    const c = this.find(id);
    const cup = this.cup;
    if (!c || !cup || !this.canAct()) return;
    if (!cup.sealed) return this.fail("Hãy dán nắp trước khi giao");
    const d = c.data;
    if (d.state === "ordering") transition(d, "waiting");
    if (d.state !== "waiting") return;
    const delivery = d.delivery;
    const lastCup = !delivery || delivery.done + 1 >= delivery.orders.length;
    if (lastCup && !transition(d, "receiving")) return;

    const result = evaluate({ cup, order: d.order, patience: d.patience, tolerance: ARCHETYPES[d.archetype].tolerance });
    const good = !result.wrongDrink && result.quality >= COMBO_QUALITY;
    const combo = good ? this.combo + 1 : 0;
    const pay = payment(d.order, result, d.archetype, this.save.upgrades, {
      priceMul: this.mod("priceMul"),
      tipMul: this.weather.tipMul * (1 + comboTipBonus(combo)),
    });
    let commission: number | undefined;
    if (delivery) {
      const split = splitCommission(pay.price);
      pay.price = split.net;
      commission = split.commission;
      delivery.qualitySum += result.quality;
      delivery.done++;
    }
    this.host.served({ ...pay, quality: result.quality, recipeId: d.order.recipeId, archetype: d.archetype, combo, commission });
    if (good) {
      this.combo = combo;
      if (combo >= 2) this.events.emit({ type: "combo", count: combo });
    } else this.breakCombo();
    if (this.tutorial) {
      this.host.tutorialCompleted();
      this.hint = null;
      this.host.notify("Tuyệt vời! Bạn đã hoàn thành ly đầu tiên. Quán chính thức mở cửa!", "good");
    }
    this.cup = null;
    if (delivery && !lastCup) return this.nextDeliveryCup(c, result.quality, pay.price);
    c.timer = TIMING.receive;

    const g = grade(result.quality);
    const happy = result.quality >= 60;
    this.setMood(c, happy ? "happy" : "sad");
    this.events.emit({ type: "served", id: d.id, info: { recipeId: d.order.recipeId, quality: result.quality, stars: g.stars, label: g.label, price: pay.price, tip: pay.tip, happy } });
    this.say(c, happy ? "Ngon quá! Cảm ơn nha~ meo!" : result.notes[0] ? `Hmm... ${result.notes[0].toLowerCase()}.` : "Hmm... chưa đúng ý lắm.");
    void this.enrichLine(c, happy ? "happy" : "sad");
    if (d.archetype === "granny" || d.archetype === "tiktoker") this.guestReaction(c, result.quality, result.wrongDrink);
    if (!happy && result.notes.length) this.host.notify(`Góp ý: ${result.notes.slice(0, 3).join(", ")}`, "info");
    if (!this.tutorial) this.review(c, delivery ? delivery.qualitySum / delivery.orders.length : result.quality);
    if (this.selectedId === d.id) this.selectNext();
  }

  /** Granny thanks you with a gift; the TikToker posts a video that helps or hurts. */
  private guestReaction(c: ShopCustomer, quality: number, wrongDrink: boolean) {
    if (c.data.archetype === "granny") {
      if (wrongDrink || quality < GRANNY_HAPPY_QUALITY) return;
      const added = this.host.gift(GRANNY_GIFT.ingredient, GRANNY_GIFT.amount);
      this.host.adjustReputation(GRANNY_GIFT.reputation);
      this.say(c, "Ngon lắm con. Bà có hũ trân châu tự nấu, cho con nè!");
      this.host.notify(added > 0 ? `Bà cụ tặng ${added} phần trân châu và kể về quán với hàng xóm (+${GRANNY_GIFT.reputation} danh tiếng).` : `Bà cụ khen quán với hàng xóm (+${GRANNY_GIFT.reputation} danh tiếng). Kho trân châu đã đầy nên bà mang quà về.`, "good");
      return;
    }
    const v = tiktokerVerdict(quality, wrongDrink);
    if (v.kind === "viral") {
      this.host.adjustReputation(v.reputation);
      this.applyEffects([{ kind: "spawnMul", value: v.spawnMul, duration: v.duration }]);
      this.say(c, "Đỉnh nóc kịch trần! Lên xu hướng liền!");
      this.host.notify(`Video của mèo TikToker lên xu hướng! +${v.reputation} danh tiếng, khách kéo tới đông hơn một lúc.`, "good");
    } else if (v.kind === "flop") {
      this.host.adjustReputation(v.reputation);
      this.say(c, "Ơ... cả nhà ơi, quán này hơi phèn nha.");
      this.host.notify(`Mèo TikToker đăng video chê quán. ${v.reputation} danh tiếng.`, "bad");
    } else {
      this.host.notify("Mèo TikToker đăng video bình thường, không ai để ý lắm.", "info");
    }
  }

  /** A shipper got one cup of several: show it, then switch their ticket to the next cup. */
  private nextDeliveryCup(c: ShopCustomer, quality: number, price: number) {
    const d = c.data;
    const delivery = d.delivery!;
    const g = grade(quality);
    const happy = quality >= 60;
    this.events.emit({ type: "served", id: d.id, info: { recipeId: d.order.recipeId, quality, stars: g.stars, label: g.label, price, tip: 0, happy } });
    d.order = delivery.orders[delivery.done];
    d.patience = Math.min(100, d.patience + 25);
    this.setMood(c, happy ? "happy" : "sad");
    this.say(c, `Còn ${delivery.orders.length - delivery.done} ly nữa nha!`);
    this.events.emit({ type: "nextCup", id: d.id });
    this.host.changed();
  }

  // ------------------------------------------------------------ reviews, combo
  private breakCombo() {
    if (this.combo >= 2) this.events.emit({ type: "combo", count: 0 });
    this.combo = 0;
  }

  /** Malus today: rival effects plus rubbish on the floor. */
  private currentMalus() {
    if (this.malus && this.malus.chance > 0) return this.malus;
    if (this.trash.length) return { chance: Math.min(0.6, this.trash.length * 0.12), texts: TRASH_TEXTS };
    return null;
  }

  private review(c: ShopCustomer, quality: number | null) {
    const d = c.data;
    const r = writeReview({ quality, patience: d.patience, archetype: d.archetype, critic: d.critic, rng: this.deps.rng, malus: this.currentMalus() });
    const id = this.host.reviewed({ ...r, archetype: d.archetype, critic: d.critic });
    this.events.emit({ type: "review", id: d.id, stars: r.stars, text: r.text });
    // Now and then let the AI write a fresh comment for the same star rating.
    if (!d.critic && this.deps.rng() < 0.2) {
      void this.deps.dialogue
        .line({ archetype: d.archetype, event: "review", recipeId: d.order.recipeId, stage: r.stars })
        .then((text) => text && this.host.reviseReview(id, text))
        .catch(() => undefined);
    }
  }

  // ------------------------------------------------------------ rival & effects
  private tickRival() {
    const plan = this.save.plan;
    if (this.rivalFired || this.closing || this.tutorial || !plan?.rival || plan.day !== this.save.day) return;
    if (this.clock < plan.rivalAt * DAY.lengthSec) return;
    this.rivalFired = true;
    this.stopPour();
    this.events.emit({ type: "rival", id: plan.rival });
    this.host.rivalStrikes(plan.rival);
  }

  private tickEffects(dt: number) {
    for (const [kind, e] of this.timed) {
      e.left -= dt;
      if (e.left <= 0) {
        this.timed.delete(kind);
        this.host.changed();
      }
    }
    if (this.malus) {
      this.malus.left -= dt;
      if (this.malus.left <= 0) this.malus = null;
    }
  }

  /** Applies rival-event effects (a duration of 0 clears that modifier). */
  applyEffects(effects: Effect[]) {
    for (const e of effects) {
      switch (e.kind) {
        case "priceMul":
        case "spawnMul":
        case "decayMul":
        case "pourMul":
          if (e.duration <= 0 || e.value === 1) this.timed.delete(e.kind);
          else this.timed.set(e.kind, { value: e.value, left: e.duration });
          break;
        case "malus":
          this.malus = e.duration > 0 && e.chance > 0 ? { chance: e.chance, texts: e.texts, left: e.duration } : null;
          break;
        case "trash":
          if (e.count <= 0) this.trash = [];
          else for (let i = 0; i < e.count; i++) this.trash.push(this.makeTrash());
          this.events.emit({ type: "trash", items: [...this.trash] });
          break;
        case "fakeReviews":
          break;
      }
    }
    this.host.changed();
  }

  private makeTrash(): TrashItem {
    const r = this.deps.rng;
    return { id: this.nextTrashId++, x: 0.08 + r() * 0.84, y: 0.05 + r() * 0.9, kind: Math.floor(r() * 5) };
  }

  /** Player picks up one piece of rubbish. */
  sweep(id: number) {
    if (!this.canAct()) return;
    const before = this.trash.length;
    this.trash = this.trash.filter((t) => t.id !== id);
    if (this.trash.length === before) return;
    this.events.emit({ type: "trash", items: [...this.trash] });
    if (!this.trash.length) this.host.notify("Sạch bong! Quán lại thơm tho.", "good");
    this.host.changed();
  }

  // ------------------------------------------------------------ helpers
  private requireCup(): boolean {
    if (this.cup) return true;
    this.fail("Hãy lấy ly trước (chạm vào chồng ly M hoặc L)");
    return false;
  }

  private fail(message: string) {
    this.host.notify(message, "bad");
    this.events.emit({ type: "rejected" });
  }

  private reject(r: ActionResult, stock: IngredientId | "sugar" | "ice" | "topping") {
    if (r.ok) return;
    this.fail(rejectionMessage(r.reason, stock));
  }

  private updateHint() {
    const next = tutorialHint(this.customers[0], this.cup);
    if (next.step !== this.hint?.step) {
      this.hint = next;
      this.host.changed();
    }
  }
}
