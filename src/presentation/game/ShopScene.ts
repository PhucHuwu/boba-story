import * as Phaser from "phaser";
import type { GameController } from "@/application/game/gameController";
import type { PourSource, ShopCustomer, ShopEvent, TrashItem } from "@/application/game/shopSession";
import type { HintTarget } from "@/application/game/tutorial";
import { INGREDIENTS, RECIPE_BY_ID, TEA_IDS } from "@/domain/catalog";
import { liquidTotal } from "@/domain/cup";
import { maxCustomers, type Customer } from "@/domain/customers";
import { isDecorId } from "@/domain/decor";
import { hasShopCat } from "@/domain/visitors";
import type { IngredientId, Mood, Size, TeaId, ToppingId } from "@/domain/types";
import manifest from "./assetManifest.json";
import { audio } from "./audio";
import { CupView } from "./cupRenderer";
import { COLORS, type Layout, SHORT_RECIPE_NAME, type StationId, slotX } from "./layout";
import { DECOR_SPOTS } from "./decorSpots";
import { KEY_BY_STATION, STATION_KEYS } from "./keymap";
import { presentTicket } from "./ticketPresenter";

/** Canvas text cannot resolve CSS variables, so read the real family next/font generated. */
function resolveFont(): string {
  const family = typeof document === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--font-baloo").trim();
  return `${family ? `${family}, ` : ""}system-ui, sans-serif`;
}

const FONT = resolveFont();

interface CatView {
  id: number;
  slot: number;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  card: Phaser.GameObjects.Container;
  cardArt: Phaser.GameObjects.Image;
  /** Selection ring drawn over the card art. */
  cardBg: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Container;
  baseScale: number;
  idleTweens: Phaser.Tweens.Tween[];
  /** The drink the cat carries out after `receive_drink`. */
  held?: Phaser.GameObjects.Image;
  blinkTimer?: Phaser.Time.TimerEvent;
}

/**
 * Draw order. Everything standing on the shop floor (cats, rubbish) shares the ACTORS band and is
 * y-sorted by where it touches the floor: lower on screen = closer to the counter = drawn on top.
 */
const CUP = 20;
const DEPTH = {
  actors: 5,
  counter: 10,
  cards: 30,
  bubble: 35,
  flyingCup: 40,
  draggedCup: 45,
  highlight: 50,
  popup: 60,
  ghost: 70,
};
/**
 * Maps a floor y (canvas px, < 10000) into the ACTORS band. On the same row the earlier customer
 * (smaller id) stays in front, so a newcomer never covers someone already being served.
 */
const actorDepth = (floorY: number, id = 0) => DEPTH.actors + floorY / 10000 + (999 - (id % 1000)) / 1e8;

interface Station {
  obj: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  name: string;
  stock?: IngredientId;
  key: string;
  /** Art shown while the station is in use (tap open, jug tilted, pump pressed...). */
  busyKey?: string;
  busy: boolean;
  /** Keyboard shortcut shown at the station's corner once the player uses the keyboard. */
  keyBadge?: Phaser.GameObjects.Text;
}

const BUSY_ART: Partial<Record<StationId, string>> = {
  tea_black: "tea_black_pour",
  tea_green: "tea_green_pour",
  tea_oolong: "tea_oolong_pour",
  milk: "milk_pour",
  sugar: "sugar_press",
  ice: "ice_scoop",
  sealer: "sealer_press",
  shaker: "shaker_shake",
};
/** Vertices along the pour stream rope. */
const STREAM_POINTS = 14;
/** pour_stream is 39px wide; this makes the stream ~14px on the canvas. */
const STREAM_SCALE = 0.36;
/** ui_ticket is drawn at this scale; the tape then covers ~42px of the ticket's top-left corner. */
const TICKET_ART_SCALE = 0.45;
const TICKET_TAPE_W = 34;
const SCOOP_ART: Record<ToppingId, string> = { top_boba: "scoop_boba", top_jelly: "scoop_jelly", top_pudding: "scoop_pudding" };
/** Where a cat holds a received drink, as fractions of the cat height from the feet (container origin). */
const HOLD = { x: 0.04, y: -0.4 };
/** How long a tap-to-use station keeps its "in use" art. */
const BUSY_TAP_MS = 320;

/**
 * Humble view of the shop: renders `ShopSession` state and forwards input as commands.
 * No game rules live here.
 */
export class ShopScene extends Phaser.Scene {
  private cats = new Map<number, CatView>();
  private trashViews = new Map<number, Phaser.GameObjects.Image>();
  private stations = new Map<StationId, Station>();
  private cupView!: CupView;
  private stream!: Phaser.GameObjects.Rope;
  private highlight!: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;
  private ticketTitle!: Phaser.GameObjects.Text;
  private ticketLines!: Phaser.GameObjects.Text;
  private dragGhost: Phaser.GameObjects.Image | null = null;
  private pouringFrom: PourSource | null = null;
  private busyTimers = new Map<StationId, Phaser.Time.TimerEvent>();
  private dragTopping: ToppingId | null = null;
  private draggingCup = false;
  private dragStart = { x: 0, y: 0 };
  private pourSounding = false;
  private hintStep = -1;
  private wasPaused = false;
  private dirty = true;
  private shopCat: Phaser.GameObjects.Image | null = null;
  /** Set on the first shortcut key: station labels then show their key. */
  private keyboardUsed = false;
  private keyPouring: string | null = null;
  private decorViews = new Map<string, Phaser.GameObjects.Image>();
  /** False until the first sync, so decor already owned at load appears without a pop-in. */
  private decorShown = false;
  private bgScale = 1;
  private unsubscribe: (() => void)[] = [];

  constructor(
    private readonly ctl: GameController,
    private readonly L: Layout,
  ) {
    super("shop");
  }

  private get session() {
    return this.ctl.session;
  }

  private get reduced() {
    return this.ctl.save.settings.reducedMotion;
  }

  preload() {
    this.load.on("progress", (p: number) => this.ctl.setLoadProgress(p * 0.99));
    for (const [key, file] of Object.entries(manifest as Record<string, string>)) this.load.image(key, `/assets/${file}`);
  }

  create() {
    // ui_bubble (360×158): the rounded body is y 0..125; the tail hangs below around x 160..209.
    const bubbleArt = this.textures.get("ui_bubble");
    if (!bubbleArt.has("body")) {
      bubbleArt.add("body", 0, 0, 0, 360, 126);
      bubbleArt.add("tail", 0, 150, 116, 66, 42);
    }
    this.buildRoom();
    this.buildWorktop();
    this.buildStations();
    this.cupView = new CupView(this, this.L.cup, CUP);
    this.stream = this.add.rope(0, 0, "pour_stream", undefined, Array.from({ length: STREAM_POINTS }, (_, i) => ({ x: 0, y: i })), false).setDepth(19).setScale(STREAM_SCALE).setVisible(false);
    this.cupView.onMark = () => audio.play("ting");
    this.highlight = this.add.graphics().setDepth(DEPTH.highlight);
    this.buildCupHitArea();
    this.bindInput();

    this.unsubscribe.push(
      this.session.events.on((e) => this.onEvent(e)),
      this.ctl.subscribe(() => {
        this.dirty = true;
        this.syncPause();
        this.syncShopCat();
      }),
    );
    this.restoreCustomers();
    this.syncTrash(this.session.trash);
    this.syncShopCat();
    const detach = () => {
      this.unsubscribe.forEach((u) => u());
      this.unsubscribe = [];
      audio.stopPour();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, detach);
    this.events.once(Phaser.Scenes.Events.DESTROY, detach);
    this.ctl.setLoadProgress(1);
  }

  /** Rebuilds cat views for a session already in progress (e.g. after rotating the device remounts the scene). */
  private restoreCustomers() {
    for (const cust of this.session.customers) {
      const { state } = cust.data;
      if (state === "leaving" || state === "gone") continue;
      this.spawnCat(cust, state === "approaching" ? Math.max(0.05, cust.timer) : 0.05);
      const c = this.cats.get(cust.data.id);
      if (!c || state === "approaching") continue;
      c.card.setAlpha(1).setY(this.L.cardY);
      this.setMood(cust.data.id, cust.mood);
    }
  }

  // ---------------------------------------------------------------- static layout
  private buildRoom() {
    const { room, counterY } = this.L;
    const bg = this.add.image(0, room.bgY, "bg_room").setOrigin(0, 0);
    bg.setDisplaySize(room.w, (room.w / bg.width) * bg.height);
    this.bgScale = room.w / bg.width;
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x3b2416, 0x3b2416, 0x3b2416, 0x3b2416, 0.35, 0.35, 0, 0);
    shade.fillRect(0, 0, room.w, 200);

    const g = this.add.graphics().setDepth(DEPTH.counter);
    g.fillStyle(0x9c6440, 1).fillRect(0, counterY - 6, room.w, 40);
    if (this.textures.exists("counter_front")) {
      const rail = this.add.image(-10, counterY - 26, "counter_front").setOrigin(0, 0).setDepth(DEPTH.counter);
      rail.setDisplaySize(room.w + 20, Math.max(34, ((room.w + 20) / rail.width) * rail.height));
      return;
    }
    g.fillStyle(0xc68a5b, 1).fillRoundedRect(-10, counterY - 26, room.w + 20, 34, 12);
    g.fillStyle(0xe2ab78, 1).fillRoundedRect(-10, counterY - 26, room.w + 20, 10, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(3, 0x5b3523, 1).strokeRoundedRect(-10, counterY - 26, room.w + 20, 34, 12);
  }

  private buildWorktop() {
    const { worktop: w, counterFront: f, ticket: t } = this.L;
    this.add.tileSprite(w.x, w.y, w.w, w.h, "worktop").setOrigin(0, 0).setDepth(11).setTileScale(0.6, 0.6);
    const edge = this.add.graphics().setDepth(12).fillStyle(0x5b3523, 0.25);
    if (w.x > 0) edge.fillRect(w.x, w.y, 10, w.h);
    else edge.fillRect(w.x, w.y, w.w, 8);
    for (const r of this.L.benchRows ?? []) {
      edge.fillStyle(0x5b3523, 0.1).fillRoundedRect(r.x, r.y, r.w, r.h, 22);
      edge.lineStyle(3, 0x5b3523, 0.18).strokeRoundedRect(r.x, r.y, r.w, r.h, 22);
      edge.fillStyle(0x5b3523, 0.25);
    }
    if (f) {
      this.add.tileSprite(f.x, f.y, f.w, f.h, "worktop").setOrigin(0, 0).setDepth(11).setTileScale(0.6, 0.6).setTint(0xd9b48f);
      edge.fillRect(f.x, f.y, f.w, 8);
    }
    // ui_ticket (720×210): the paper spans x 32..718, y 32..208; the tape sits in the top-left corner.
    const ts = TICKET_ART_SCALE;
    this.add
      .nineslice(t.x - 32 * ts, t.y - 32 * ts, "ui_ticket", undefined, t.w / ts + 33, t.h / ts + 33, 130, 20, 120, 20)
      .setOrigin(0, 0)
      .setScale(ts)
      .setDepth(13);
    const pad = 12;
    this.ticketTitle = this.add
      .text(t.x + pad + TICKET_TAPE_W, t.y + 8, "", { fontFamily: FONT, fontSize: `${t.titleSize}px`, color: "#4a2c1d", fontStyle: "800" })
      .setDepth(14);
    this.ticketLines = this.add
      .text(t.x + pad, t.y + 14 + t.titleSize * 1.25, "", {
        fontFamily: FONT,
        fontSize: `${t.textSize}px`,
        color: "#6b4430",
        lineSpacing: Math.round(t.textSize * 0.25),
        wordWrap: { width: t.w - pad * 2 },
      })
      .setDepth(14);
  }

  private fit(img: Phaser.GameObjects.Image, maxW: number, maxH: number) {
    const s = Math.min(maxW / img.width, maxH / img.height);
    img.setScale(s).setData("baseScale", s);
    return img;
  }

  private addStation(id: StationId, key: string, name: string, stock?: IngredientId) {
    const spot = this.L.stations[id];
    const obj = this.fit(this.add.image(spot.x, spot.y, key), spot.w, spot.h).setDepth(15).setInteractive({ useHandCursor: true });
    const label = this.add
      .text(spot.x, spot.labelY ?? spot.y + spot.h / 2 + 4, name, {
        fontFamily: FONT,
        fontSize: this.L.kind === "phone" ? "17px" : "19px",
        color: "#4a2c1d",
        fontStyle: "700",
        align: "center",
        backgroundColor: "rgba(255,248,236,0.85)",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0)
      .setDepth(16);
    obj.on("pointerover", () => this.ctl.isInteractive() && this.tweens.add({ targets: obj, scale: obj.getData("baseScale") * 1.06, duration: 100 }));
    obj.on("pointerout", () => this.tweens.add({ targets: obj, scale: obj.getData("baseScale"), duration: 100 }));
    obj.setData("y0", spot.y);
    const shortcut = id === "trash" ? "Del" : KEY_BY_STATION[id];
    const keyBadge = shortcut
      ? this.add
          .text(spot.x - spot.w / 2 + 4, spot.y - spot.h / 2 + 4, shortcut, {
            fontFamily: FONT,
            fontSize: "17px",
            color: "#fff8ec",
            fontStyle: "800",
            backgroundColor: "#4a2c1d",
            padding: { x: 6, y: 1 },
          })
          .setOrigin(0, 0)
          .setDepth(16)
          .setVisible(false)
      : undefined;
    const st: Station = { obj, label, name, stock, key, busyKey: BUSY_ART[id], busy: false, keyBadge };
    this.stations.set(id, st);
    return st;
  }

  private buildStations() {
    const teaName: Record<TeaId, string> = { tea_black: "Trà đen", tea_green: "Trà xanh", tea_oolong: "Ô long" };
    TEA_IDS.forEach((t) => this.addStation(t, t, teaName[t], t).obj.on("pointerdown", () => this.pour(t)));
    this.addStation("milk", "milk", "Sữa", "milk").obj.on("pointerdown", () => this.pour("milk"));
    this.addStation("sugar", "sugar", "Đường", "sugar").obj.on("pointerdown", () => this.command(() => this.session.pumpSugar()));
    this.addStation("ice", "ice", "Đá", "ice").obj.on("pointerdown", () => this.command(() => this.session.scoopIce()));

    const take = (size: Size) => () => this.command(() => this.session.takeCup(size));
    this.addStation("cup_M", "cup_stack", "Ly M", "cup").obj.on("pointerdown", take("M"));
    this.addStation("cup_L", "cup_stack", "Ly L", "cup").obj.on("pointerdown", take("L"));
    this.addStation("sealer", "sealer", "Dán nắp", "lid").obj.on("pointerdown", () => this.command(() => this.session.sealCup()));
    this.addStation("shaker", "shaker", "Lắc").obj.on("pointerdown", () => this.command(() => this.session.shakeCup()));
    this.addStation("trash", "trash", "Bỏ ly").obj.on("pointerdown", () => this.command(() => this.session.discardCup()));

    const tops: [ToppingId, string][] = [
      ["top_boba", "Trân châu"],
      ["top_jelly", "Thạch dừa"],
      ["top_pudding", "Pudding"],
    ];
    for (const [t, name] of tops) {
      this.addStation(t, t, name, t).obj.on("pointerdown", (p: Phaser.Input.Pointer) => this.startToppingDrag(t, p));
    }
  }

  private buildCupHitArea() {
    const { cup } = this.L;
    const hit = this.add.zone(cup.x, cup.y, 170, 230).setDepth(21).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.session.cup?.sealed && this.ctl.isInteractive()) {
        this.draggingCup = true;
        this.cupView.drag({ x: 0, y: 0 }, DEPTH.draggedCup);
        this.dragStart = { x: p.x, y: p.y };
      }
    });
  }

  // ---------------------------------------------------------------- input → commands
  private command(fn: () => void) {
    audio.unlock();
    fn();
  }

  private pour(source: PourSource) {
    this.command(() => this.session.startPour(source));
  }

  private bindInput() {
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.dragGhost?.setPosition(p.x, p.y);
      if (this.draggingCup) {
        this.cupView.drag({ x: p.x - this.L.cup.x, y: p.y - this.L.cup.y }, DEPTH.draggedCup);
        const target = this.catAt(p);
        for (const c of this.cats.values()) c.sprite.setAlpha(target && c !== target ? 0.75 : 1);
      }
    });
    // Cats are hit-tested by slot, not by sprite: their bodies are tweened containers and sprite hit areas proved unreliable.
    this.input.on("pointerdown", (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      const cat = this.catAt(p);
      if (cat) this.command(() => this.session.tapCustomer(cat.id));
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on("gameout", () => this.session.stopPour());
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => this.onKeyDown(e));
    this.input.keyboard?.on("keyup", (e: KeyboardEvent) => {
      if (e.code !== this.keyPouring) return;
      this.keyPouring = null;
      this.session.stopPour();
    });
  }

  /** Keyboard play (GDD §5.3): Esc cancels the action in progress before it pauses; see keymap.ts. */
  private onKeyDown(e: KeyboardEvent) {
    if (this.ctl.phase !== "open" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === "Escape") {
      if (this.ctl.modal) this.ctl.closeModal();
      else if (!this.cancelAction()) this.ctl.openModal("pause");
      return;
    }
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, button")) return;
    if (!this.ctl.isInteractive() || e.repeat) return;
    const slot = /^Digit([1-4])$/.exec(e.code)?.[1];
    if (slot) {
      const target = this.session.customers.find((c) => c.data.slot === Number(slot) - 1 && (c.data.state === "ordering" || c.data.state === "waiting"));
      if (target) this.command(() => this.session.tapCustomer(target.data.id));
      return this.markKeyboard(e);
    }
    if (e.code === "Space") {
      this.command(() => this.session.deliverToSelected());
      return this.markKeyboard(e);
    }
    if (e.code === "Delete" || e.code === "Backspace") {
      this.command(() => this.session.discardCup());
      return this.markKeyboard(e);
    }
    const key = STATION_KEYS.find((k) => k.code === e.code);
    if (!key) return;
    this.useStation(key.station, e.code);
    this.markKeyboard(e);
  }

  private markKeyboard(e: KeyboardEvent) {
    e.preventDefault();
    if (!this.keyboardUsed) {
      this.keyboardUsed = true;
      this.dirty = true;
    }
  }

  /** Same command a tap on the station sends; pours run until the key is released. */
  private useStation(id: StationId, code: string) {
    const s = this.session;
    switch (id) {
      case "tea_black":
      case "tea_green":
      case "tea_oolong":
      case "milk":
        this.keyPouring = code;
        return this.pour(id);
      case "sugar":
        return this.command(() => s.pumpSugar());
      case "ice":
        return this.command(() => s.scoopIce());
      case "cup_M":
      case "cup_L":
        return this.command(() => s.takeCup(id === "cup_M" ? "M" : "L"));
      case "sealer":
        return this.command(() => s.sealCup());
      case "shaker":
        return this.command(() => s.shakeCup());
      case "trash":
        return this.command(() => s.discardCup());
      default: {
        const st = this.stations.get(id);
        if (st && !this.reduced) this.press(st.obj);
        return this.command(() => s.addTopping(id));
      }
    }
  }

  /** Esc: drops a topping or cup being dragged, or stops a pour. Returns false when nothing was in progress. */
  private cancelAction(): boolean {
    if (this.dragTopping) {
      this.endToppingDrag();
      return true;
    }
    if (this.draggingCup) {
      this.draggingCup = false;
      this.cupView.drag(null);
      for (const c of this.cats.values()) c.sprite.setAlpha(1);
      return true;
    }
    if (this.session.pouring) {
      this.keyPouring = null;
      this.session.stopPour();
      return true;
    }
    return false;
  }

  private startToppingDrag(t: ToppingId, p: Phaser.Input.Pointer) {
    if (!this.ctl.isInteractive()) return;
    audio.unlock();
    this.dragTopping = t;
    this.dragStart = { x: p.x, y: p.y };
    this.dragGhost = this.fit(this.add.image(p.x, p.y, SCOOP_ART[t]).setDepth(DEPTH.ghost).setAngle(-12), 120, 90);
  }

  private endToppingDrag() {
    this.dragGhost?.destroy();
    this.dragGhost = null;
    this.dragTopping = null;
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    this.session.stopPour();
    const moved = Phaser.Math.Distance.Between(p.x, p.y, this.dragStart.x, this.dragStart.y);
    if (this.dragTopping) {
      const overCup = Phaser.Math.Distance.Between(p.x, p.y, this.L.cup.x, this.L.cup.y) < 140;
      if (moved < 12 || overCup) this.session.addTopping(this.dragTopping);
      else this.ctl.notify("Thả topping vào ly để thêm", "info");
      this.endToppingDrag();
    }
    if (this.draggingCup) {
      this.draggingCup = false;
      this.cupView.drag(null);
      for (const c of this.cats.values()) c.sprite.setAlpha(1);
      const target = this.catAt(p);
      if (target) this.session.deliver(target.id);
      else if (moved < 12) this.session.deliverToSelected();
    }
  }

  /** Customer drawn above `depth` whose visible (non-transparent) pixels are under the pointer. */
  private catCovering(p: Phaser.Input.Pointer, depth: number): CatView | undefined {
    let best: CatView | undefined;
    const active = new Set(this.session.customers.filter((c) => c.data.state === "waiting" || c.data.state === "ordering").map((c) => c.data.id));
    for (const c of this.cats.values()) {
      if (!active.has(c.id) || c.root.depth <= depth || c.root.alpha < 0.5 || (best && best.root.depth > c.root.depth)) continue;
      const local = c.sprite.getLocalPoint(p.x, p.y);
      const { width, height } = c.sprite.frame;
      if (local.x < 0 || local.y < 0 || local.x >= width || local.y >= height) continue;
      const alpha = this.textures.getPixelAlpha(Math.floor(local.x), Math.floor(local.y), c.sprite.texture.key);
      if ((alpha ?? 0) > 40) best = c;
    }
    return best;
  }

  private catAt(p: Phaser.Input.Pointer): CatView | undefined {
    if (p.y > this.L.counterY + 20 || p.x > this.L.room.w || p.y < this.L.cardY - 70) return undefined;
    const slots = maxCustomers(this.ctl.save);
    const half = (slotX(this.L, 1, slots) - slotX(this.L, 0, slots)) / 2;
    const waiting = new Set(this.session.customers.filter((c) => c.data.state === "waiting" || c.data.state === "ordering").map((c) => c.data.id));
    return [...this.cats.values()].find((c) => waiting.has(c.id) && Math.abs(slotX(this.L, c.slot, slots) - p.x) < half);
  }

  // ---------------------------------------------------------------- session events → animation
  private onEvent(e: ShopEvent) {
    switch (e.type) {
      case "reset":
        for (const c of this.cats.values()) this.destroyCat(c);
        this.cats.clear();
        this.syncTrash([]);
        this.setBusy("sealer", false);
        this.endToppingDrag();
        this.hintStep = -1;
        this.drawHint(null);
        if (this.ctl.phase === "open") audio.play("bell");
        break;
      case "arrived":
        this.spawnCat(e.customer, e.duration);
        break;
      case "ordering": {
        const c = this.cats.get(e.id);
        if (!c) break;
        this.tweens.add({ targets: c.card, alpha: 1, y: this.L.cardY, duration: 250 });
        this.setIdle(c, true, "idle");
        this.orderGesture(c);
        audio.play("bell");
        break;
      }
      case "leaving":
        this.walkOut(e.id, e.delay, e.duration);
        break;
      case "gone": {
        const c = this.cats.get(e.id);
        if (c) this.destroyCat(c);
        this.cats.delete(e.id);
        break;
      }
      case "mood":
        this.setMood(e.id, e.mood);
        break;
      case "say":
        this.say(e.id, e.text);
        break;
      case "selected":
        audio.play("click");
        break;
      case "served": {
        const c = this.cats.get(e.id);
        if (!c) break;
        const keeps = this.session.customers.find((x) => x.data.id === e.id)?.data.state === "receiving";
        const flying = this.fit(this.add.image(this.L.cup.x, this.L.cup.y, `drink_${e.info.recipeId}`).setDepth(DEPTH.flyingCup), 80, 120);
        const hand = { x: c.root.x + HOLD.x * this.L.catHeight, y: c.root.y + HOLD.y * this.L.catHeight };
        this.tweens.add({
          targets: flying,
          x: hand.x,
          y: hand.y,
          scale: flying.scale * 0.8,
          duration: 350,
          ease: "Quad.easeOut",
          onComplete: () => {
            flying.destroy();
            if (keeps && this.cats.get(e.id) === c) this.receiveDrink(c, `drink_${e.info.recipeId}`);
          },
        });
        const { info } = e;
        audio.play(info.happy ? "happy" : "sad");
        if (info.price + info.tip > 0) this.time.delayedCall(250, () => audio.play("coin"));
        this.floatStars(c.root.x, this.L.cardY + 40, info.stars, 3);
        this.floatText(c.root.x, this.L.cardY + 85, `${info.label}\n+${info.price} xu${info.tip ? `  +${info.tip} tip` : ""}`, info.happy ? "#2f6b2f" : "#9a3b3b");
        break;
      }
      case "cup": {
        const sound = { take: "click", sugar: "pump", ice: "ice", topping: "plop", shakeStart: "shake", shaken: "ting", sealStart: "seal", sealed: "click", discard: "plop" } as const;
        audio.play(sound[e.action]);
        if (e.action === "sugar" || e.action === "ice") {
          this.flashBusy(e.action);
          this.press(this.stations.get(e.action)!.obj, e.duration);
        }
        if (e.action === "sealStart") {
          this.setBusy("sealer", true);
          this.press(this.stations.get("sealer")!.obj, e.duration);
        }
        if (e.action === "shakeStart") {
          this.setBusy("shaker", true);
          const shaker = this.stations.get("shaker")!.obj;
          this.wobble(shaker, e.duration ?? 0.9, 14);
          this.cupView.shake(e.duration ?? 0.9);
        }
        if (e.action === "shaken" || e.action === "discard") this.setBusy("shaker", false);
        if (e.action === "sealed" || e.action === "discard") this.setBusy("sealer", false);
        break;
      }
      case "rejected":
        audio.play("error");
        break;
      case "closing":
        break;
      case "review": {
        const c = this.cats.get(e.id);
        const x = c ? c.root.x : this.L.room.w / 2;
        this.floatStars(x, this.L.bubbleY - 30, e.stars);
        this.time.delayedCall(450, () => audio.play(e.stars >= 4 ? "star" : e.stars <= 2 ? "bad" : "click"));
        break;
      }
      case "combo":
        if (e.count === 0) {
          this.floatText(this.L.cup.x, this.L.cup.y - 160, "Mất combo!", "#9a3b3b");
          break;
        }
        this.floatText(this.L.cup.x, this.L.cup.y - 160, `Combo x${e.count}`, "#e08a3c", "icon_combo");
        if (e.count % 5 === 0) audio.play("fanfare");
        break;
      case "trash":
        this.syncTrash(e.items);
        break;
      case "nextCup": {
        const c = this.cats.get(e.id);
        const d = this.session.customers.find((x) => x.data.id === e.id)?.data;
        if (c && d) {
          this.fillCard(c, d);
          if (!this.reduced) this.tweens.add({ targets: c.card, scale: { from: 1.12, to: 1 }, duration: 260, ease: "Back.easeOut" });
        }
        break;
      }
      case "rival":
        if (!this.reduced) this.cameras.main.shake(300, 0.006);
        break;
    }
    this.dirty = true;
  }

  /** Quick "pressed" bounce that always returns to the station's original position. */
  /** Swaps a station to its "in use" art, refitted to the same box and standing on the same baseline. */
  private setBusy(id: StationId, busy: boolean) {
    const st = this.stations.get(id);
    if (!st?.busyKey || st.busy === busy) return;
    st.busy = busy;
    const spot = this.L.stations[id];
    const { obj } = st;
    const bottom = spot.y + (obj.height * obj.getData("baseScale")) / 2;
    this.tweens.killTweensOf(obj);
    obj.setTexture(busy ? st.busyKey : st.key);
    this.fit(obj, spot.w, spot.h);
    const y0 = busy ? bottom - obj.displayHeight / 2 : spot.y;
    obj.setY(y0).setData("y0", y0);
  }

  private flashBusy(id: StationId) {
    this.busyTimers.get(id)?.remove();
    this.setBusy(id, true);
    this.busyTimers.set(id, this.time.delayedCall(BUSY_TAP_MS, () => this.setBusy(id, false)));
  }

  /** Taps open while pouring; the jug tilts for milk. */
  private syncPourArt() {
    const from = this.ctl.running && this.session.cup ? this.session.pouring : null;
    if (from === this.pouringFrom) return;
    if (this.pouringFrom) this.setBusy(this.pouringFrom, false);
    this.pouringFrom = from;
    if (from) this.setBusy(from, true);
  }

  /** Rocks a sprite side to side for `durationSec` (the shaker while shaking). */
  private wobble(obj: Phaser.GameObjects.Image, durationSec: number, degrees: number) {
    if (this.reduced) return;
    const beats = Math.max(2, Math.round(durationSec / 0.15));
    this.tweens.add({ targets: obj, angle: { from: -degrees, to: degrees }, duration: (durationSec * 1000) / beats, yoyo: true, repeat: Math.floor(beats / 2) - 1, onComplete: () => obj.setAngle(0) });
  }

  private press(obj: Phaser.GameObjects.Image, durationSec = 0.14) {
    const y0: number = obj.getData("y0") ?? obj.y;
    obj.setData("y0", y0);
    this.tweens.killTweensOf(obj);
    obj.setY(y0).setScale(obj.getData("baseScale"));
    this.tweens.add({ targets: obj, y: y0 + 7, duration: Math.min(220, durationSec * 500), yoyo: true });
  }

  private spawnCat(customer: ShopCustomer, duration: number) {
    const d = customer.data;
    const slots = maxCustomers(this.ctl.save);
    const x = slotX(this.L, d.slot, slots);
    const sprite = this.add.image(0, 0, this.catTexture(d, "idle")).setOrigin(0.5, 1);
    const baseScale = this.L.catHeight / sprite.height;
    sprite.setScale(baseScale);
    const root = this.add.container(this.L.door.x, this.L.door.y, [sprite]).setDepth(actorDepth(this.L.door.y, d.id)).setScale(0.45).setAlpha(0);

    const card = this.add.container(x, this.L.cardY - 10).setDepth(DEPTH.cards).setAlpha(0);
    const cardBg = this.add.graphics();
    // ui_card (360×280): body y 0..239 with the tail below, drawn at half size over -90..90 × -64..76.
    const cardArt = this.add.image(0, -64, "ui_card").setOrigin(0.5, 0).setDisplaySize(180, 140);
    const text = (y: number, s: string, size: number, color: string, weight: string) =>
      this.add.text(0, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: weight, align: "center" }).setOrigin(0.5);
    const status = text(22, "", 15, "#9a3b3b", "800");
    const bar = this.add.rectangle(-75, 44, 150, 10, COLORS.good).setOrigin(0, 0.5);
    const zone = this.add.zone(0, 0, 180, 120).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.command(() => this.session.tapCustomer(d.id)));
    const title = text(-40, "", 21, "#4a2c1d", "800");
    const detail = text(-8, "", 16, "#6b4430", "700");
    card.add([
      cardArt,
      cardBg,
      title,
      detail,
      status,
      this.add.rectangle(-75, 44, 150, 10, 0xe9d7c3).setOrigin(0, 0.5),
      bar,
      zone,
    ]);

    if (d.critic && this.textures.exists("icon_critic")) card.add(this.add.image(80, -66, "icon_critic").setDisplaySize(48, 48));
    const view: CatView = { id: d.id, slot: d.slot, root, sprite, card, cardArt, cardBg, bar, status, title, detail, baseScale, idleTweens: [] };
    this.fillCard(view, d);
    if (d.delivery && this.textures.exists("icon_delivery")) card.add(this.add.image(-80, -66, "icon_delivery").setDisplaySize(48, 48));
    this.cats.set(d.id, view);
    this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.tweens.add({ targets: root, x, y: this.L.counterY + 30, scale: 1, duration: duration * 1000, ease: "Sine.easeInOut" });
    if (!this.reduced) this.waddle(view, duration * 1000);
  }

  /** Two-legged walk: bounce + side-to-side sway. */
  private waddle(c: CatView, ms: number) {
    const steps = Math.max(2, Math.round(ms / 260));
    this.tweens.add({ targets: c.sprite, y: -12, duration: 130, yoyo: true, repeat: steps - 1, ease: "Sine.easeOut" });
    c.sprite.setAngle(-3);
    this.tweens.add({ targets: c.sprite, angle: 3, duration: 260, yoyo: true, repeat: Math.floor(steps / 2), ease: "Sine.easeInOut", onComplete: () => c.sprite.setAngle(0) });
  }

  /**
   * Standing animation (GDD §3.3), all tweened so it works on single-frame art:
   * idle breathes and shifts its weight, impatient taps a foot, disappointed slumps.
   */
  private setIdle(c: CatView, on: boolean, mood: Mood = "idle") {
    for (const t of c.idleTweens) t.remove();
    c.idleTweens = [];
    c.blinkTimer?.remove();
    c.blinkTimer = undefined;
    c.sprite.setScale(c.baseScale).setAngle(0).setY(0);
    if (!on || this.reduced) return;
    const s = c.baseScale;
    const add = (cfg: Phaser.Types.Tweens.TweenBuilderConfig) => c.idleTweens.push(this.tweens.add(cfg));
    if (mood === "impatient") {
      add({ targets: c.sprite, y: -5, duration: 110, yoyo: true, repeat: -1, repeatDelay: 380, ease: "Quad.easeOut" });
      add({ targets: c.sprite, angle: { from: -1.5, to: 1.5 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return;
    }
    if (mood === "sad") {
      c.sprite.setScale(s * 1.01, s * 0.965).setAngle(-2);
      add({ targets: c.sprite, scaleY: s * 0.955, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      return;
    }
    add({ targets: c.sprite, scaleY: s * 1.015, scaleX: s * 0.995, duration: 1400 + Math.random() * 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    add({ targets: c.sprite, angle: { from: -1.2, to: 1.2 }, duration: 2400 + Math.random() * 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (mood === "idle") this.scheduleBlink(c);
  }

  /** Swaps in the eyes-closed frame for a moment every few seconds (only when that art exists). */
  private scheduleBlink(c: CatView) {
    const open = c.sprite.texture.key;
    const closed = open.endsWith("_idle") ? `${open.slice(0, -5)}_blink` : "";
    if (!closed || !this.textures.exists(closed)) return;
    c.blinkTimer = this.time.delayedCall(2500 + Math.random() * 3500, () => {
      if (c.sprite.texture.key !== open) return;
      c.sprite.setTexture(closed);
      this.time.delayedCall(140, () => {
        if (c.sprite.texture.key === closed) c.sprite.setTexture(open);
        if (c.blinkTimer) this.scheduleBlink(c);
      });
    });
  }

  /** `order`: a little hop and lean toward the ticket as the order pops up. */
  private orderGesture(c: CatView) {
    if (this.reduced) return;
    this.tweens.add({ targets: c.root, y: c.root.y - 14, duration: 120, yoyo: true, repeat: 1, ease: "Quad.easeOut" });
    this.tweens.add({ targets: c.root, angle: { from: 0, to: c.root.x < this.L.room.w / 2 ? 4 : -4 }, duration: 200, yoyo: true, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: c.card, scale: { from: 0.7, to: 1 }, duration: 320, ease: "Back.easeOut" });
  }

  /** `receive_drink`: the cup lands in the cat's front paws and leaves the shop with them. */
  private receiveDrink(c: CatView, key: string) {
    if (!this.textures.exists(key)) return;
    c.held?.destroy();
    const h = this.L.catHeight;
    const cup = this.add.image(HOLD.x * h, HOLD.y * h, key).setOrigin(0.5, 0.5);
    cup.setScale((h * 0.2) / cup.height);
    c.root.add(cup);
    c.held = cup;
    if (this.reduced) return;
    this.tweens.add({ targets: c.root, y: c.root.y - 10, duration: 140, yoyo: true, ease: "Quad.easeOut" });
    this.tweens.add({ targets: cup, angle: { from: -10, to: 0 }, duration: 260, ease: "Back.easeOut" });
  }

  private walkOut(id: number, delaySec: number, durationSec: number) {
    const c = this.cats.get(id);
    if (!c) return;
    this.tweens.add({ targets: c.card, alpha: 0, duration: 200 });
    this.time.delayedCall(delaySec * 1000, () => {
      this.tweens.killTweensOf(c.root);
      this.tweens.killTweensOf(c.sprite);
      c.sprite.setAngle(0).setY(0);
      c.root.setAlpha(1).setAngle(0);
      this.setIdle(c, false);
      c.sprite.setFlipX(c.root.x < this.L.door.x);
      const ms = durationSec * 1000;
      this.tweens.add({ targets: c.root, x: this.L.door.x, y: this.L.door.y, scale: 0.45, duration: ms, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: c.root, alpha: 0, delay: ms * 0.7, duration: ms * 0.3 });
      if (!this.reduced) this.waddle(c, ms);
    });
  }

  private destroyCat(c: CatView) {
    for (const t of c.idleTweens) t.remove();
    c.blinkTimer?.remove();
    c.root.destroy();
    c.card.destroy();
    c.bubble?.destroy();
  }

  private setMood(id: number, mood: Mood) {
    const c = this.cats.get(id);
    if (!c) return;
    const data = this.session.customers.find((x) => x.data.id === id)?.data;
    if (!data) return;
    c.sprite.setTexture(this.catTexture(data, mood));
    c.baseScale = this.L.catHeight / c.sprite.height;
    const state = this.session.customers.find((x) => x.data.id === id)?.data.state;
    this.setIdle(c, state === "ordering" || state === "waiting" || state === "receiving", mood);
  }

  /** Sprite for a customer and mood; shippers use their app brand and fall back to the idle pose. */
  private catTexture(d: Customer, mood: Mood): string {
    const base = d.delivery ? `shipper_${d.delivery.brand}` : `cat_${d.archetype}`;
    const key = `${base}_${mood}`;
    return this.textures.exists(key) ? key : `${base}_idle`;
  }

  /** Order ticket text; shippers also show which cup of the delivery this is. */
  private fillCard(c: CatView, d: Customer) {
    const order = d.order;
    const name = SHORT_RECIPE_NAME[order.recipeId] ?? RECIPE_BY_ID[order.recipeId].name;
    const cupNo = d.delivery ? `Ly ${d.delivery.done + 1}/${d.delivery.orders.length}: ` : "";
    c.title.setText(cupNo + name).setFontSize(21);
    if (c.title.width > 168) c.title.setFontSize(Math.floor((21 * 168) / c.title.width));
    c.detail.setText(`${order.size} · Đường ${order.sugar}% · Đá ${order.ice}%`);
  }

  private say(id: number, text: string) {
    const c = this.cats.get(id);
    if (!c) return;
    c.bubble?.destroy();
    const t = this.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: "17px", color: "#3d2618", fontStyle: "600", align: "center", wordWrap: { width: 200 } })
      .setOrigin(0.5);
    const w = Math.max(120, t.width + 24);
    const h = t.height + 18;
    // ui_bubble: the body (frame "body") stretches as a nine-slice; the tail keeps its shape underneath.
    const bs = 0.5;
    const body = this.add.nineslice(0, 0, "ui_bubble", "body", w / bs, h / bs, 40, 40, 34, 30).setScale(bs);
    const tail = this.add.image(0, h / 2 - 10 * bs, "ui_bubble", "tail").setOrigin(0.5, 0).setScale(bs);
    const x = Phaser.Math.Clamp(slotX(this.L, c.slot, maxCustomers(this.ctl.save)), w / 2 + 6, this.L.room.w - w / 2 - 6);
    const bubble = this.add.container(x, this.L.bubbleY + 10, [body, tail, t]).setDepth(DEPTH.bubble).setAlpha(0);
    c.bubble = bubble;
    this.tweens.add({ targets: bubble, alpha: 1, y: this.L.bubbleY, duration: 200 });
    this.tweens.add({
      targets: bubble,
      alpha: 0,
      delay: 3800,
      duration: 400,
      onComplete: () => {
        if (c.bubble === bubble) c.bubble = undefined;
        bubble.destroy();
      },
    });
  }

  private floatText(x: number, y: number, text: string, color: string, icon?: string) {
    const cx = Phaser.Math.Clamp(x, 110, this.L.room.w - 110);
    const t = this.add
      .text(cx, y, text, {
        fontFamily: FONT,
        fontSize: "24px",
        color,
        fontStyle: "900",
        align: "center",
        stroke: "#ffffff",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.popup);
    const parts: Phaser.GameObjects.Components.Transform[] = [t];
    if (icon && this.textures.exists(icon)) {
      const img = this.add.image(cx - t.width / 2 - 18, y, icon).setDisplaySize(40, 40).setDepth(DEPTH.popup);
      t.setX(cx + 18);
      parts.push(img);
    }
    this.tweens.add({ targets: parts, y: y - 70, alpha: 0, delay: 1100, duration: 900, onComplete: () => parts.forEach((p) => (p as unknown as Phaser.GameObjects.GameObject).destroy()) });
  }

  /** Review popup: a row of five star sprites, unearned ones dimmed. */
  private floatStars(x: number, y: number, stars: number, total = 5) {
    const size = 30;
    const cx = Phaser.Math.Clamp(x, 110, this.L.room.w - 110);
    const row = this.add.container(cx, y).setDepth(DEPTH.popup);
    for (let i = 0; i < total; i++) {
      const s = this.add.image((i - (total - 1) / 2) * (size + 2), 0, "star").setDisplaySize(size, size);
      if (i >= stars) s.setTint(0xc9b39a).setAlpha(0.55);
      row.add(s);
    }
    this.tweens.add({ targets: row, y: y - 70, alpha: 0, delay: 1100, duration: 900, onComplete: () => row.destroy() });
  }

  /** Rubbish dumped by the rival: tap each piece to sweep it (interactive objects win over cat taps). */
  private syncTrash(items: TrashItem[]) {
    const keep = new Set(items.map((t) => t.id));
    for (const [id, view] of this.trashViews) {
      if (keep.has(id)) continue;
      this.trashViews.delete(id);
      view.disableInteractive();
      this.tweens.add({ targets: view, alpha: 0, scale: 0.2, angle: 90, duration: 220, onComplete: () => view.destroy() });
    }
    const keys = ["trash_can", "trash_banana", "trash_paper", "trash_box", "trash_bone"];
    for (const t of items) {
      if (this.trashViews.has(t.id)) continue;
      const x = 50 + t.x * (this.L.room.w - 100);
      const y = this.L.counterY - 30 - t.y * 110;
      const key = keys[t.kind % keys.length];
      const view = this.add
        .image(x, y, this.textures.exists(key) ? key : this.trashFallback())
        .setDisplaySize(64, 64)
        .setDepth(actorDepth(y + 32))
        .setAngle(t.kind * 23 - 40);
      view.setInteractive({ useHandCursor: true });
      view.on("pointerdown", (p: Phaser.Input.Pointer) =>
        this.command(() => {
          if (!this.ctl.isInteractive()) return;
          // Rubbish sits behind customers standing at the counter: a tap on a cat's body goes to the cat.
          const front = this.catCovering(p, view.depth);
          if (front) return this.session.tapCustomer(front.id);
          audio.play("sweep");
          this.session.sweep(t.id);
        }),
      );
      this.trashViews.set(t.id, view);
      if (!this.reduced) {
        view.setY(y - 260).setAlpha(0);
        this.tweens.add({ targets: view, y, alpha: 1, duration: 420, delay: t.kind * 60, ease: "Bounce.easeOut" });
        this.time.delayedCall(200, () => audio.play("trash"));
      }
    }
  }

  /** The adopted stray naps on the end of the counter. */
  private syncShopCat() {
    if (this.shopCat || !hasShopCat(this.ctl.save) || !this.textures.exists("npc_stray_happy")) return;
    const h = this.L.catHeight * 0.34;
    const img = this.add.image(this.L.room.w - h * 0.38, this.L.counterY - 14, "npc_stray_happy").setOrigin(0.5, 1);
    img.setScale(h / img.height).setDepth(DEPTH.counter + 0.5);
    this.shopCat = img;
    if (!this.reduced) this.tweens.add({ targets: img, scaleY: img.scaleY * 1.03, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  /** Crumpled paper ball drawn once, used until the trash art exists. */
  private trashFallback() {
    const key = "trash_fallback";
    if (this.textures.exists(key)) return key;
    const g = this.add.graphics();
    g.fillStyle(0xf3ead8).lineStyle(4, 0x4a2c1d);
    const pts = [32, 4, 50, 12, 60, 30, 54, 50, 36, 60, 16, 54, 4, 36, 10, 14].map((v) => v + 2);
    const poly = [];
    for (let i = 0; i < pts.length; i += 2) poly.push(new Phaser.Math.Vector2(pts[i], pts[i + 1]));
    g.fillPoints(poly, true).strokePoints(poly, true);
    g.lineStyle(3, 0xb59a7a).lineBetween(18, 22, 34, 32).lineBetween(34, 32, 48, 24).lineBetween(26, 46, 40, 40);
    g.generateTexture(key, 68, 68);
    g.destroy();
    return key;
  }

  // ---------------------------------------------------------------- frame
  private syncPause() {
    const paused = this.ctl.phase === "open" && this.ctl.paused;
    if (paused === this.wasPaused) return;
    this.wasPaused = paused;
    if (paused) this.tweens.pauseAll();
    else this.tweens.resumeAll();
    this.time.paused = paused;
  }

  private syncPourSound() {
    const on = this.ctl.running && this.session.pouring !== null && this.session.cup !== null;
    if (on !== this.pourSounding) {
      this.pourSounding = on;
      if (on) audio.startPour(liquidTotal(this.session.cup!));
      else audio.stopPour();
    }
    if (on) audio.setPourFill(liquidTotal(this.session.cup!));
  }

  update(_time: number, deltaMs: number) {
    if (this.ctl.running) {
      this.session.tick(deltaMs / 1000);
      if (this.session.pouring) this.dirty = true;
    }
    for (const c of this.cats.values()) c.root.setDepth(actorDepth(c.root.y, c.id));
    this.syncPourSound();
    this.syncPourArt();
    this.cupView.tick(deltaMs);
    this.drawStream(_time);
    if (!this.dirty) return;
    this.dirty = false;
    this.renderState();
  }

  /** Owned decor at its fixed spot in the room (positions are bg_room pixels, see decorSpots.ts). */
  private syncDecor() {
    for (const id of this.ctl.save.decor) {
      if (this.decorViews.has(id) || !isDecorId(id) || !this.textures.exists(id)) continue;
      const spot = DECOR_SPOTS[id];
      const k = this.bgScale;
      const img = this.add.image(spot.x * k, this.L.room.bgY + spot.y * k, id).setOrigin(...spot.origin).setDepth(spot.depth);
      img.setScale((spot.w * k) / img.width);
      this.decorViews.set(id, img);
      if (this.decorShown && !this.reduced) {
        const sc = img.scale;
        this.tweens.add({ targets: img, scale: { from: sc * 0.6, to: sc }, alpha: { from: 0, to: 1 }, duration: 380, ease: "Back.easeOut" });
      }
    }
    this.decorShown = true;
  }

  private renderState() {
    this.syncDecor();
    const s = this.session;
    const order = s.selectedOrder;
    this.cupView.render(s.cup, order, this.ctl.save.settings.hints);
    const ticket = presentTicket(this.ctl.phase, order, s.cup);
    this.ticketTitle.setText(ticket.title);
    this.ticketLines.setText(ticket.lines);

    const inv = this.ctl.save.inventory;
    for (const st of this.stations.values()) {
      st.keyBadge?.setVisible(this.keyboardUsed);
      if (!st.stock) continue;
      const n = inv[st.stock];
      st.label.setText(`${st.name} ×${n}`).setColor(n <= 0 ? "#b23a3a" : n <= 3 ? "#b86a1d" : "#4a2c1d");
      st.obj.setAlpha(n <= 0 ? 0.45 : 1);
    }

    for (const cust of s.customers) {
      const c = this.cats.get(cust.data.id);
      if (c) this.renderCard(c, cust);
    }

    const hint = this.ctl.save.tutorialDone ? null : s.hint;
    if ((hint?.step ?? -1) !== this.hintStep) {
      this.hintStep = hint?.step ?? -1;
      this.drawHint(hint?.target ?? null);
    }
  }

  private renderCard(c: CatView, cust: ShopCustomer) {
    const d = cust.data;
    const selected = this.session.selectedId === d.id;
    const g = c.cardBg;
    if (selected) c.cardArt.setTint(COLORS.selected);
    else c.cardArt.clearTint();
    g.clear();
    if (selected) g.lineStyle(5, COLORS.caramel, 1).strokeRoundedRect(-92, -66, 184, 126, 20);

    c.bar.width = 150 * (d.patience / 100);
    c.bar.fillColor = d.patience > 60 ? COLORS.good : d.patience > 30 ? COLORS.warn : COLORS.bad;
    const impatient = cust.mood === "impatient";
    const label =
      d.state === "ordering" ? "Chạm để nhận đơn" : d.state === "waiting" ? (impatient ? "Sốt ruột!" : selected ? "Đang pha" : "Đang chờ") : "";
    c.status.setText(label).setColor(impatient ? "#b23a3a" : "#5b7c3a");
  }

  /** The pour stream: `pour_stream` bent along an arc from the spout to the liquid surface, tinted like the liquid. */
  private drawStream(time: number) {
    const source = this.ctl.running && this.session.cup ? this.session.pouring : null;
    const st = source ? this.stations.get(source) : undefined;
    if (!source || !st) {
      this.stream.setVisible(false);
      this.cupView.setPouring(null, time);
      return;
    }
    const color = source === "milk" ? 0xffffff : INGREDIENTS[source].color;
    const { obj } = st;
    const sx = obj.x + (source === "milk" ? -obj.displayWidth * 0.42 : obj.displayWidth * 0.08);
    const sy = obj.y + (source === "milk" ? -obj.displayHeight * 0.1 : obj.displayHeight * 0.3);
    const end = this.cupView.surfacePoint;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(sx, sy),
      new Phaser.Math.Vector2(end.x + (sx - end.x) * 0.15, sy - 6),
      new Phaser.Math.Vector2(end.x + Math.sin(time / 90) * 2, end.y),
    );
    // The rope's width is the texture width, so draw it scaled down with the points scaled up to match.
    const pts = curve.getPoints(STREAM_POINTS - 1).map((p) => ({ x: p.x / STREAM_SCALE, y: p.y / STREAM_SCALE }));
    this.stream.setVisible(true).setPoints(pts);
    this.stream.setColors(color);
    this.stream.setAlphas(0.95);
    this.cupView.setPouring(color, time);
  }

  private drawHint(target: HintTarget) {
    this.highlightTween?.remove();
    this.highlight.clear().setAlpha(1);
    const rect = this.hintRect(target);
    if (!rect) return;
    const { x, y, w, h } = rect;
    this.highlight.lineStyle(6, COLORS.highlight, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    this.highlight.lineStyle(2, 0xffffff, 1).strokeRoundedRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10, 14);
    if (!this.reduced) this.highlightTween = this.tweens.add({ targets: this.highlight, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
  }

  private hintRect(target: HintTarget): { x: number; y: number; w: number; h: number } | null {
    if (!target) return null;
    if (target.kind === "station") {
      const o = this.stations.get(target.id)?.obj;
      return o ? { x: o.x, y: o.y, w: o.displayWidth + 24, h: o.displayHeight + 24 } : null;
    }
    const c = this.cats.get(target.customerId);
    if (!c) return null;
    const x = slotX(this.L, c.slot, maxCustomers(this.ctl.save));
    return target.kind === "card" ? { x, y: this.L.cardY, w: 190, h: 130 } : { x, y: this.L.counterY + 30 - this.L.catHeight / 2, w: this.L.catHeight * 0.62, h: this.L.catHeight * 0.8 };
  }
}
