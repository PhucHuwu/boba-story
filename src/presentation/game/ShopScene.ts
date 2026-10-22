import * as Phaser from "phaser";
import type { GameController } from "@/application/game/gameController";
import type { PourSource, ShopCustomer, ShopEvent } from "@/application/game/shopSession";
import type { HintTarget } from "@/application/game/tutorial";
import { INGREDIENTS, RECIPE_BY_ID, TEA_IDS } from "@/domain/catalog";
import { maxCustomers } from "@/domain/customers";
import type { IngredientId, Mood, Size, TeaId, ToppingId } from "@/domain/types";
import manifest from "./assetManifest.json";
import { audio } from "./audio";
import { drawCup } from "./cupRenderer";
import { BUBBLE_Y, CARD_Y, CAT_HEIGHT, COLORS, COUNTER_Y, CUP_POS, DOOR, GAME_W, SHORT_RECIPE_NAME, slotX } from "./layout";
import { presentTicket } from "./ticketPresenter";

export const FONT = "var(--font-baloo), system-ui, sans-serif";

interface CatView {
  id: number;
  slot: number;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  card: Phaser.GameObjects.Container;
  cardBg: Phaser.GameObjects.Graphics;
  bar: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Container;
  baseScale: number;
  idleTween?: Phaser.Tweens.Tween;
}

interface Station {
  obj: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  name: string;
  stock?: IngredientId;
}

type StationId = TeaId | "milk" | "sugar" | "ice" | "cup_M" | "cup_L" | "sealer" | "trash" | ToppingId;

/**
 * Humble view of the shop: renders `ShopSession` state and forwards input as commands.
 * No game rules live here.
 */
export class ShopScene extends Phaser.Scene {
  private cats = new Map<number, CatView>();
  private stations = new Map<StationId, Station>();
  private cupGfx!: Phaser.GameObjects.Graphics;
  private gauge!: Phaser.GameObjects.Graphics;
  private stream!: Phaser.GameObjects.Graphics;
  private highlight!: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;
  private ticketBg!: Phaser.GameObjects.Graphics;
  private ticketTitle!: Phaser.GameObjects.Text;
  private ticketLines!: Phaser.GameObjects.Text;
  private dragGhost: Phaser.GameObjects.Image | null = null;
  private dragTopping: ToppingId | null = null;
  private draggingCup = false;
  private dragStart = { x: 0, y: 0 };
  private pourSoundIn = 0;
  private hintStep = -1;
  private wasPaused = false;
  private dirty = true;
  private unsubscribe: (() => void)[] = [];

  constructor(private readonly ctl: GameController) {
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
    for (const key of manifest as string[]) this.load.image(key, `/assets/${key}.webp`);
  }

  create() {
    this.buildRoom();
    this.buildWorktop();
    this.buildStations();
    this.cupGfx = this.add.graphics().setDepth(20);
    this.gauge = this.add.graphics().setDepth(20);
    this.stream = this.add.graphics().setDepth(19);
    this.highlight = this.add.graphics().setDepth(50);
    this.buildCupHitArea();
    this.bindInput();

    this.unsubscribe.push(
      this.session.events.on((e) => this.onEvent(e)),
      this.ctl.subscribe(() => {
        this.dirty = true;
        this.syncPause();
      }),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));
    this.ctl.setLoadProgress(1);
  }

  // ---------------------------------------------------------------- static layout
  private buildRoom() {
    const bg = this.add.image(0, -250, "bg_room").setOrigin(0, 0);
    bg.setDisplaySize(GAME_W, (GAME_W / bg.width) * bg.height);
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x3b2416, 0x3b2416, 0x3b2416, 0x3b2416, 0.35, 0.35, 0, 0);
    shade.fillRect(0, 0, GAME_W, 200);

    const g = this.add.graphics().setDepth(10);
    g.fillStyle(0x9c6440, 1).fillRect(0, COUNTER_Y - 6, GAME_W, 40);
    g.fillStyle(0xc68a5b, 1).fillRoundedRect(-10, COUNTER_Y - 26, GAME_W + 20, 34, 12);
    g.fillStyle(0xe2ab78, 1).fillRoundedRect(-10, COUNTER_Y - 26, GAME_W + 20, 10, { tl: 12, tr: 12, bl: 0, br: 0 });
    g.lineStyle(3, 0x5b3523, 1).strokeRoundedRect(-10, COUNTER_Y - 26, GAME_W + 20, 34, 12);
  }

  private buildWorktop() {
    this.add
      .tileSprite(0, COUNTER_Y + 8, GAME_W, 1280 - COUNTER_Y, "worktop")
      .setOrigin(0, 0)
      .setDepth(11)
      .setTileScale(0.6, 0.6);
    this.add.graphics().setDepth(12).fillStyle(0x5b3523, 0.25).fillRect(0, COUNTER_Y + 8, GAME_W, 8);
    this.ticketBg = this.add.graphics().setDepth(13);
    this.ticketBg.fillStyle(COLORS.paper, 0.95).fillRoundedRect(12, COUNTER_Y + 16, GAME_W - 24, 112, 14);
    this.ticketBg.lineStyle(3, COLORS.cocoa, 1).strokeRoundedRect(12, COUNTER_Y + 16, GAME_W - 24, 112, 14);
    this.ticketTitle = this.add.text(24, COUNTER_Y + 24, "", { fontFamily: FONT, fontSize: "26px", color: "#4a2c1d", fontStyle: "800" }).setDepth(14);
    this.ticketLines = this.add
      .text(24, COUNTER_Y + 60, "", { fontFamily: FONT, fontSize: "20px", color: "#6b4430", lineSpacing: 4, wordWrap: { width: GAME_W - 48 } })
      .setDepth(14);
  }

  private fit(img: Phaser.GameObjects.Image, maxW: number, maxH: number) {
    const s = Math.min(maxW / img.width, maxH / img.height);
    img.setScale(s).setData("baseScale", s);
    return img;
  }

  private addStation(id: StationId, key: string, x: number, y: number, maxW: number, maxH: number, name: string, stock?: IngredientId) {
    const obj = this.fit(this.add.image(x, y, key), maxW, maxH).setDepth(15).setInteractive({ useHandCursor: true });
    const label = this.add
      .text(x, y + maxH / 2 + 4, name, {
        fontFamily: FONT,
        fontSize: "17px",
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
    const st = { obj, label, name, stock };
    this.stations.set(id, st);
    return st;
  }

  private buildStations() {
    const rowB = 880;
    const teaName: Record<TeaId, string> = { tea_black: "Trà đen", tea_green: "Trà xanh", tea_oolong: "Ô long" };
    TEA_IDS.forEach((t, i) => this.addStation(t, t, 68 + i * 118, rowB, 112, 150, teaName[t], t).obj.on("pointerdown", () => this.pour(t)));
    this.addStation("milk", "milk", 422, rowB + 6, 104, 130, "Sữa", "milk").obj.on("pointerdown", () => this.pour("milk"));
    this.addStation("sugar", "sugar", 540, rowB, 80, 140, "Đường", "sugar").obj.on("pointerdown", () => this.command(() => this.session.pumpSugar()));
    this.addStation("ice", "ice", 650, rowB + 10, 120, 110, "Đá", "ice").obj.on("pointerdown", () => this.command(() => this.session.scoopIce()));

    const rowC = 1070;
    const take = (size: Size) => () => this.command(() => this.session.takeCup(size));
    this.addStation("cup_M", "cup_stack", 58, rowC + 10, 70, 130, "Ly M", "cup").obj.on("pointerdown", take("M"));
    this.addStation("cup_L", "cup_stack", 150, rowC, 84, 160, "Ly L", "cup").obj.on("pointerdown", take("L"));
    this.addStation("sealer", "sealer", 545, rowC - 4, 150, 160, "Dán nắp", "lid").obj.on("pointerdown", () => this.command(() => this.session.sealCup()));
    this.addStation("trash", "trash", 670, rowC + 30, 70, 100, "Bỏ ly").obj.on("pointerdown", () => this.command(() => this.session.discardCup()));

    const rowD = 1205;
    const tops: [ToppingId, string][] = [
      ["top_boba", "Trân châu"],
      ["top_jelly", "Thạch dừa"],
      ["top_pudding", "Pudding"],
    ];
    tops.forEach(([t, name], i) => {
      const st = this.addStation(t, t, 130 + i * 190, rowD - 8, 130, 80, name, t);
      st.label.setY(rowD + 34);
      st.obj.on("pointerdown", (p: Phaser.Input.Pointer) => this.startToppingDrag(t, p));
    });
  }

  private buildCupHitArea() {
    const hit = this.add.zone(CUP_POS.x, CUP_POS.y, 170, 230).setDepth(21).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.session.cup?.sealed && this.ctl.isInteractive()) {
        this.draggingCup = true;
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
    this.pourSoundIn = 0;
  }

  private bindInput() {
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.dragGhost?.setPosition(p.x, p.y);
      if (this.draggingCup) {
        this.cupGfx.setPosition(p.x - CUP_POS.x, p.y - CUP_POS.y);
        const target = this.catAt(p);
        for (const c of this.cats.values()) c.sprite.setAlpha(target && c !== target ? 0.75 : 1);
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    this.input.on("gameout", () => this.session.stopPour());
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.ctl.phase !== "open") return;
      if (this.ctl.modal) this.ctl.closeModal();
      else this.ctl.openModal("pause");
    });
    this.input.keyboard?.on("keydown-SPACE", () => this.session.deliverToSelected());
  }

  private startToppingDrag(t: ToppingId, p: Phaser.Input.Pointer) {
    if (!this.ctl.isInteractive()) return;
    audio.unlock();
    this.dragTopping = t;
    this.dragStart = { x: p.x, y: p.y };
    this.dragGhost = this.fit(this.add.image(p.x, p.y, t).setDepth(70).setAlpha(0.9), 70, 50);
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
      const overCup = Phaser.Math.Distance.Between(p.x, p.y, CUP_POS.x, CUP_POS.y) < 140;
      if (moved < 12 || overCup) this.session.addTopping(this.dragTopping);
      else this.ctl.notify("Thả topping vào ly để thêm", "info");
      this.endToppingDrag();
    }
    if (this.draggingCup) {
      this.draggingCup = false;
      this.cupGfx.setPosition(0, 0);
      for (const c of this.cats.values()) c.sprite.setAlpha(1);
      const target = this.catAt(p);
      if (target) this.session.deliver(target.id);
      else if (moved < 12) this.session.deliverToSelected();
    }
  }

  private catAt(p: Phaser.Input.Pointer): CatView | undefined {
    if (p.y > COUNTER_Y + 20) return undefined;
    const slots = maxCustomers(this.ctl.save);
    const half = (slotX(1, slots) - slotX(0, slots)) / 2;
    const waiting = new Set(this.session.customers.filter((c) => c.data.state === "waiting" || c.data.state === "ordering").map((c) => c.data.id));
    return [...this.cats.values()].find((c) => waiting.has(c.id) && Math.abs(slotX(c.slot, slots) - p.x) < half);
  }

  // ---------------------------------------------------------------- session events → animation
  private onEvent(e: ShopEvent) {
    switch (e.type) {
      case "reset":
        for (const c of this.cats.values()) this.destroyCat(c);
        this.cats.clear();
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
        this.tweens.add({ targets: c.card, alpha: 1, y: CARD_Y, duration: 250 });
        this.setIdle(c, true);
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
        const flying = this.fit(this.add.image(CUP_POS.x, CUP_POS.y, "cup_stack").setDepth(40), 60, 90);
        this.tweens.add({ targets: flying, x: c.root.x, y: 470, scale: flying.scale * 0.8, duration: 350, ease: "Quad.easeOut", onComplete: () => flying.destroy() });
        const { info } = e;
        audio.play(info.happy ? "happy" : "sad");
        if (info.price + info.tip > 0) this.time.delayedCall(250, () => audio.play("coin"));
        const stars = `${"★".repeat(info.stars)}${"☆".repeat(3 - info.stars)}`;
        this.floatText(c.root.x, 300, `${stars} ${info.label}\n+${info.price} xu${info.tip ? `  +${info.tip} tip` : ""}`, info.happy ? "#2f6b2f" : "#9a3b3b");
        break;
      }
      case "cup": {
        const sound = { take: "click", sugar: "pump", ice: "ice", topping: "plop", sealStart: "seal", sealed: "click", discard: "plop" } as const;
        audio.play(sound[e.action]);
        if (e.action === "sugar" || e.action === "ice" || e.action === "sealStart") {
          this.press(this.stations.get(e.action === "sealStart" ? "sealer" : e.action)!.obj, e.duration);
        }
        break;
      }
      case "rejected":
        audio.play("error");
        break;
      case "closing":
        break;
    }
    this.dirty = true;
  }

  /** Quick "pressed" bounce that always returns to the station's original position. */
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
    const x = slotX(d.slot, slots);
    const sprite = this.add.image(0, 0, `cat_${d.archetype}_idle`).setOrigin(0.5, 1);
    const baseScale = CAT_HEIGHT / sprite.height;
    sprite.setScale(baseScale).setInteractive({ useHandCursor: true });
    sprite.on("pointerdown", () => this.command(() => this.session.tapCustomer(d.id)));
    const root = this.add.container(DOOR.x, DOOR.y, [sprite]).setDepth(5).setScale(0.45).setAlpha(0);

    const card = this.add.container(x, CARD_Y - 10).setDepth(30).setAlpha(0);
    const cardBg = this.add.graphics();
    const text = (y: number, s: string, size: number, color: string, weight: string) =>
      this.add.text(0, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: weight, align: "center" }).setOrigin(0.5);
    const order = d.order;
    const status = text(22, "", 15, "#9a3b3b", "800");
    const bar = this.add.rectangle(-75, 44, 150, 10, COLORS.good).setOrigin(0, 0.5);
    const zone = this.add.zone(0, 0, 180, 120).setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => this.command(() => this.session.tapCustomer(d.id)));
    card.add([
      cardBg,
      text(-40, SHORT_RECIPE_NAME[order.recipeId] ?? RECIPE_BY_ID[order.recipeId].name, 21, "#4a2c1d", "800"),
      text(-8, `${order.size} · Đường ${order.sugar}% · Đá ${order.ice}%`, 16, "#6b4430", "700"),
      status,
      this.add.rectangle(-75, 44, 150, 10, 0xe9d7c3).setOrigin(0, 0.5),
      bar,
      zone,
    ]);

    const view: CatView = { id: d.id, slot: d.slot, root, sprite, card, cardBg, bar, status, baseScale };
    this.cats.set(d.id, view);
    this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    this.tweens.add({ targets: root, x, y: COUNTER_Y + 30, scale: 1, duration: duration * 1000, ease: "Sine.easeInOut" });
    if (!this.reduced) this.waddle(view, duration * 1000);
  }

  /** Two-legged walk: bounce + side-to-side sway. */
  private waddle(c: CatView, ms: number) {
    const steps = Math.max(2, Math.round(ms / 260));
    this.tweens.add({ targets: c.sprite, y: -12, duration: 130, yoyo: true, repeat: steps - 1, ease: "Sine.easeOut" });
    c.sprite.setAngle(-3);
    this.tweens.add({ targets: c.sprite, angle: 3, duration: 260, yoyo: true, repeat: Math.floor(steps / 2), ease: "Sine.easeInOut", onComplete: () => c.sprite.setAngle(0) });
  }

  private setIdle(c: CatView, on: boolean) {
    c.idleTween?.remove();
    c.idleTween = undefined;
    c.sprite.setScale(c.baseScale);
    if (!on || this.reduced) return;
    c.idleTween = this.tweens.add({
      targets: c.sprite,
      scaleY: c.baseScale * 1.015,
      scaleX: c.baseScale * 0.995,
      duration: 1400 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private walkOut(id: number, delaySec: number, durationSec: number) {
    const c = this.cats.get(id);
    if (!c) return;
    this.tweens.add({ targets: c.card, alpha: 0, duration: 200 });
    this.time.delayedCall(delaySec * 1000, () => {
      this.setIdle(c, false);
      c.sprite.setFlipX(c.root.x < DOOR.x);
      const ms = durationSec * 1000;
      this.tweens.add({ targets: c.root, x: DOOR.x, y: DOOR.y, scale: 0.45, duration: ms, ease: "Sine.easeInOut" });
      this.tweens.add({ targets: c.root, alpha: 0, delay: ms * 0.7, duration: ms * 0.3 });
      if (!this.reduced) this.waddle(c, ms);
    });
  }

  private destroyCat(c: CatView) {
    c.idleTween?.remove();
    c.root.destroy();
    c.card.destroy();
    c.bubble?.destroy();
  }

  private setMood(id: number, mood: Mood) {
    const c = this.cats.get(id);
    if (!c) return;
    c.sprite.setTexture(`cat_${this.session.customers.find((x) => x.data.id === id)?.data.archetype}_${mood}`);
    c.baseScale = CAT_HEIGHT / c.sprite.height;
    const state = this.session.customers.find((x) => x.data.id === id)?.data.state;
    this.setIdle(c, state === "ordering" || state === "waiting" || state === "receiving");
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
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.lineStyle(2, COLORS.cocoa, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    const x = Phaser.Math.Clamp(slotX(c.slot, maxCustomers(this.ctl.save)), w / 2 + 6, GAME_W - w / 2 - 6);
    const bubble = this.add.container(x, BUBBLE_Y + 10, [g, t]).setDepth(35).setAlpha(0);
    c.bubble = bubble;
    this.tweens.add({ targets: bubble, alpha: 1, y: BUBBLE_Y, duration: 200 });
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

  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add
      .text(Phaser.Math.Clamp(x, 110, GAME_W - 110), y, text, {
        fontFamily: FONT,
        fontSize: "24px",
        color,
        fontStyle: "900",
        align: "center",
        stroke: "#ffffff",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 1100, duration: 900, onComplete: () => t.destroy() });
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

  update(_time: number, deltaMs: number) {
    if (this.ctl.running) {
      this.session.tick(deltaMs / 1000);
      if (this.session.pouring) {
        this.dirty = true;
        this.pourSoundIn -= deltaMs / 1000;
        if (this.pourSoundIn <= 0) {
          audio.play("pour");
          this.pourSoundIn = 0.2;
        }
      }
    }
    this.drawStream();
    if (!this.dirty) return;
    this.dirty = false;
    this.renderState();
  }

  private renderState() {
    const s = this.session;
    const order = s.selectedOrder;
    drawCup(this.cupGfx, this.gauge, s.cup, order, this.ctl.save.settings.hints);
    const ticket = presentTicket(this.ctl.phase, order, s.cup);
    this.ticketTitle.setText(ticket.title);
    this.ticketLines.setText(ticket.lines);

    const inv = this.ctl.save.inventory;
    for (const st of this.stations.values()) {
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
    const fill = selected ? COLORS.selected : COLORS.paper;
    const line = selected ? COLORS.caramel : COLORS.cocoa;
    g.clear();
    g.fillStyle(0x000000, 0.12).fillRoundedRect(-88, -60, 180, 124, 16);
    g.fillStyle(fill, 1).fillRoundedRect(-90, -64, 180, 122, 16);
    g.lineStyle(selected ? 5 : 3, line, 1).strokeRoundedRect(-90, -64, 180, 122, 16);
    g.fillStyle(fill, 1).fillTriangle(-12, 57, 12, 57, 0, 74);
    g.lineStyle(selected ? 5 : 3, line, 1).lineBetween(-12, 58, 0, 74).lineBetween(12, 58, 0, 74);

    c.bar.width = 150 * (d.patience / 100);
    c.bar.fillColor = d.patience > 60 ? COLORS.good : d.patience > 30 ? COLORS.warn : COLORS.bad;
    const impatient = cust.mood === "impatient";
    const label =
      d.state === "ordering" ? "Chạm để nhận đơn" : d.state === "waiting" ? (impatient ? "Sốt ruột!" : selected ? "Đang pha" : "Đang chờ") : "";
    c.status.setText(label).setColor(impatient ? "#b23a3a" : "#5b7c3a");
  }

  private drawStream() {
    this.stream.clear();
    const source = this.session.pouring;
    if (!source || !this.session.cup || !this.ctl.running) return;
    const st = this.stations.get(source);
    if (!st) return;
    const color = source === "milk" ? 0xfff8ec : INGREDIENTS[source].color;
    const sx = st.obj.x + (source === "milk" ? -30 : 20);
    const sy = st.obj.y + 40;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(sx, sy),
      new Phaser.Math.Vector2((sx + CUP_POS.x) / 2, sy - 10),
      new Phaser.Math.Vector2(CUP_POS.x, CUP_POS.y - 40),
    );
    const pts = curve.getPoints(12);
    this.stream.lineStyle(10, color, 0.9).strokePoints(pts);
    this.stream.lineStyle(3, 0xffffff, 0.5).strokePoints(pts);
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
    const x = slotX(c.slot, maxCustomers(this.ctl.save));
    return target.kind === "card" ? { x, y: CARD_Y, w: 190, h: 130 } : { x, y: 480, w: 200, h: 260 };
  }
}
