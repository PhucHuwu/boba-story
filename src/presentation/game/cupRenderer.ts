import * as Phaser from "phaser";
import { INGREDIENTS, RECIPE_BY_ID, TEA_IDS } from "@/domain/catalog";
import { liquidTotal } from "@/domain/cup";
import type { CupState, Order, ToppingId } from "@/domain/types";
import type { Point } from "./layout";

const MILK_COLOR = 0xfff4e2;
const MAX_LEVEL = 1.12;

/**
 * Geometry of `cup_glass` (273×420) in its own pixels, measured from the art: the inner walls run
 * from x≈23 at the rim (v≈53) inwards by ~0.109 px per px down; the inside bottom sits at v≈392.
 * The container's origin is the bottom-centre of the image, so image pixel (u, v) is local (u - W/2, v - H).
 */
const IMG_W = 273;
const IMG_H = 420;
const BOTTOM_V = 392;
const FULL_SPAN = 280;
const SCALE = { L: 0.5, M: 0.44 } as const;
const halfWidthAt = (v: number) => IMG_W / 2 - 23 - 0.109 * (v - 53) - 4;
const lv = (v: number) => v - IMG_H;

const PIECE: Record<ToppingId, { key: string; size: number }> = {
  top_boba: { key: "piece_boba", size: 30 },
  top_jelly: { key: "piece_jelly", size: 34 },
  top_pudding: { key: "piece_pudding", size: 40 },
};
/** Pour amount near a mark that still counts as hitting it (sparkle + ting). */
const MARK_WINDOW = 0.05;
const PIECES_PER_SCOOP = 7;
const ICE_PER_SCOOP = 3;

export function mixColor(cup: CupState, total: number): number {
  let r = 0;
  let g = 0;
  let b = 0;
  const add = (color: number, w: number) => {
    r += ((color >> 16) & 255) * w;
    g += ((color >> 8) & 255) * w;
    b += (color & 255) * w;
  };
  for (const t of TEA_IDS) add(INGREDIENTS[t].color, cup.tea[t] / total);
  add(MILK_COLOR, cup.milk / total);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function shade(color: number, k: number): number {
  const c = (s: number) => Math.min(255, Math.round(((color >> s) & 255) * k));
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

/** Stable pseudo-random in [0,1) so pieces keep their spot between renders. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The cup being brewed, built from art layers, plus the fill gauge with target markers. */
export class CupView {
  readonly root: Phaser.GameObjects.Container;
  private readonly spill: Phaser.GameObjects.Image;
  private readonly liquid: Phaser.GameObjects.Graphics;
  private readonly syrup: Phaser.GameObjects.Image;
  private readonly swirl: Phaser.GameObjects.Image;
  private readonly surface: Phaser.GameObjects.Image;
  private readonly lid: Phaser.GameObjects.Image;
  private readonly straw: Phaser.GameObjects.Image;
  private readonly toppingLayer: Phaser.GameObjects.Container;
  private readonly iceLayer: Phaser.GameObjects.Container;
  private readonly gauge: Phaser.GameObjects.Graphics;
  private readonly tube: Phaser.GameObjects.Image;
  private readonly splash: Phaser.GameObjects.Image;
  private readonly base: Point;
  private scale: number = SCALE.L;
  private topV = BOTTOM_V;
  private lastTotal = 0;
  private lastTea = 0;
  /** Called when the liquid crosses the full line or the recipe's tea mark. */
  onMark: (at: Point) => void = () => {};
  private lastMilk = 0;
  private swirlLevel = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    pos: Point,
    private readonly depth: number,
  ) {
    this.base = { x: pos.x, y: pos.y + 100 };
    scene.add.image(pos.x, this.base.y - 6, "cup_coaster").setDisplaySize(180, 60).setDepth(12);
    this.spill = scene.add.image(pos.x + 26, this.base.y + 4, "fx_spill").setDisplaySize(210, 74).setDepth(12).setVisible(false);
    this.root = scene.add.container(this.base.x, this.base.y).setDepth(depth);
    this.liquid = scene.add.graphics();
    this.syrup = scene.add.image(0, lv(BOTTOM_V - 24), "liquid_syrup").setAlpha(0);
    this.toppingLayer = scene.add.container(0, 0);
    this.swirl = scene.add.image(0, 0, "liquid_swirl").setAlpha(0);
    this.surface = scene.add.image(0, 0, "liquid_surface");
    this.iceLayer = scene.add.container(0, 0);
    const glass = scene.add.image(0, 0, "cup_glass").setOrigin(0.5, 1);
    this.lid = scene.add.image(0, lv(27), "cup_lid").setDisplaySize(266, 80);
    this.straw = scene.add.image(44, lv(36), "cup_straw").setOrigin(0.5, 1).setDisplaySize(30, 200).setAngle(7);
    this.root.add([this.liquid, this.syrup, this.toppingLayer, this.swirl, this.surface, this.iceLayer, glass, this.lid, this.straw]);
    this.tube = scene.add.image(0, 0, "gauge_tube").setDepth(depth);
    this.gauge = scene.add.graphics().setDepth(depth);
    this.splash = scene.add.image(0, 0, "fx_splash").setDepth(depth + 0.5).setVisible(false);
  }

  /** Where a pour stream should land: the middle of the liquid surface, in world space. */
  get surfacePoint(): Point {
    return { x: this.root.x, y: this.root.y + this.scale * lv(this.topV) };
  }

  /** Splash at the surface while pouring, tinted like the stream. */
  setPouring(color: number | null, time: number) {
    if (color === null || !this.root.visible) {
      this.splash.setVisible(false);
      return;
    }
    const p = this.surfacePoint;
    const wobble = 1 + Math.sin(time / 70) * 0.08;
    this.splash
      .setVisible(true)
      .setTint(color)
      .setPosition(p.x + Math.sin(time / 110) * 3, p.y - 10)
      .setDisplaySize(64 * wobble, 40 / wobble);
  }

  private sparkle(at: Point) {
    const img = this.scene.add.image(at.x, at.y, "fx_sparkle").setDepth(this.depth + 1).setDisplaySize(30, 30);
    const s = img.scale;
    this.scene.tweens.add({ targets: img, scale: s * 2, alpha: 0, angle: 25, duration: 650, ease: "Quad.easeOut", onComplete: () => img.destroy() });
    this.onMark(at);
  }

  /** Moves the cup while it is dragged to a customer (coaster and gauge stay put); `null` puts it back. */
  drag(offset: Point | null, depth = this.depth) {
    this.root.setPosition(this.base.x + (offset?.x ?? 0), this.base.y + (offset?.y ?? 0)).setDepth(offset ? depth : this.depth);
  }

  /** Fades the milk swirl after the milk stops flowing. */
  tick(deltaMs: number) {
    if (this.swirlLevel <= 0) return;
    this.swirlLevel = Math.max(0, this.swirlLevel - deltaMs / 2200);
    this.swirl.setAlpha(Math.min(0.8, this.swirlLevel));
  }

  render(cup: CupState | null, order: Order | undefined, hints: boolean) {
    this.gauge.clear();
    this.root.setVisible(!!cup);
    this.tube.setVisible(!!cup);
    if (!cup) {
      this.lastTotal = 0;
      this.lastTea = 0;
      this.topV = BOTTOM_V;
      this.spill.setVisible(false);
      this.lastMilk = 0;
      this.swirlLevel = 0;
      this.swirl.setAlpha(0);
      return;
    }
    const s = SCALE[cup.size];
    this.root.setScale(s);
    this.scale = s;
    const total = liquidTotal(cup);
    const has = total > 0.01;
    const topV = BOTTOM_V - FULL_SPAN * Math.min(total, MAX_LEVEL);
    const color = has ? mixColor(cup, total) : MILK_COLOR;

    if (cup.milk > this.lastMilk + 0.001) this.swirlLevel = 1.4;
    this.lastMilk = cup.milk;
    this.topV = has ? topV : BOTTOM_V;
    this.checkMarks(cup, order, hints, total);

    this.spill.setVisible(cup.overflow).setTint(color);
    this.drawLiquid(topV, color, has);
    const hw = halfWidthAt(topV);
    this.surface
      .setVisible(has)
      .setTint(color)
      .setPosition(0, lv(topV))
      .setDisplaySize(hw * 2 + 8, Math.max(16, hw * 0.38));
    this.swirl
      .setVisible(has && cup.milk > 0)
      .setPosition(0, lv((topV + BOTTOM_V) / 2))
      .setDisplaySize(Math.min(150, hw * 1.4), Math.max(30, Math.min(170, (BOTTOM_V - topV) * 0.8)));
    this.syrup.setAlpha(cup.sugarPumps > 0 ? Math.min(0.9, 0.35 + cup.sugarPumps * 0.14) : 0).setDisplaySize(150, 56);

    this.renderToppings(cup.toppings, has ? topV : BOTTOM_V - 120);
    this.renderIce(cup.iceScoops, has ? topV : null);

    this.lid.setVisible(cup.sealed);
    this.straw.setVisible(cup.sealed);
    this.drawGauge(cup, order, hints);
  }

  /** Sparkle + ting once when the pour reaches the full line, or the tea mark of a milk recipe. */
  private checkMarks(cup: CupState, order: Order | undefined, hints: boolean, total: number) {
    const tea = TEA_IDS.reduce((a, t) => a + cup.tea[t], 0);
    const gx = this.gaugeX();
    const crossed = (prev: number, now: number, mark: number) => prev < mark - MARK_WINDOW && now >= mark - MARK_WINDOW && now <= mark + MARK_WINDOW;
    if (crossed(this.lastTotal, total, 1)) this.sparkle({ x: gx, y: this.gaugeY(1) });
    const r = order && RECIPE_BY_ID[order.recipeId];
    if (r && hints && r.milkRatio > 0 && cup.milk === 0 && crossed(this.lastTea, tea, r.teaRatio)) this.sparkle({ x: gx, y: this.gaugeY(r.teaRatio) });
    this.lastTotal = total;
    this.lastTea = tea;
  }

  private gaugeX() {
    return this.base.x + (IMG_W / 2) * this.scale + 24;
  }

  private gaugeY(v: number) {
    return this.base.y + this.scale * lv(BOTTOM_V - FULL_SPAN * Math.min(v, 1.15));
  }

  private drawLiquid(topV: number, color: number, has: boolean) {
    const g = this.liquid.clear();
    if (!has) return;
    const hwTop = halfWidthAt(topV);
    const bottomC = BOTTOM_V - 14;
    const hwBot = halfWidthAt(bottomC);
    const outline = (k: number, fromV: number) => {
      const pts = [new Phaser.Math.Vector2(-halfWidthAt(fromV) * k, lv(fromV)), new Phaser.Math.Vector2(halfWidthAt(fromV) * k, lv(fromV))];
      // Rounded bottom following the cup's base.
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI;
        pts.push(new Phaser.Math.Vector2(Math.cos(a) * hwBot * k, lv(bottomC) + Math.sin(a) * 16));
      }
      return pts;
    };
    g.fillStyle(color, 0.93).fillPoints(outline(1, topV), true);
    // A darker lower half gives the drink some depth.
    const mid = Math.max(topV + 10, topV + (BOTTOM_V - topV) * 0.5);
    if (mid < bottomC) g.fillStyle(shade(color, 0.8), 0.3).fillPoints(outline(1, mid), true);
    // Light streak on the left, like light passing through the plastic.
    g.fillStyle(0xffffff, 0.16).fillRect(-hwTop + 14, lv(topV) + 14, 14, Math.max(0, BOTTOM_V - topV - 40));
  }

  private pool(layer: Phaser.GameObjects.Container, n: number, key: string): Phaser.GameObjects.Image[] {
    while (layer.length < n) layer.add(this.scene.add.image(0, 0, key).setVisible(false));
    const list = layer.list as Phaser.GameObjects.Image[];
    for (let i = n; i < list.length; i++) list[i].setVisible(false);
    return list.slice(0, n);
  }

  private renderToppings(toppings: ToppingId[], surfaceV: number) {
    const imgs = this.pool(this.toppingLayer, toppings.length * PIECES_PER_SCOOP, "piece_boba");
    toppings.forEach((t, i) => {
      const { key, size } = PIECE[t];
      for (let k = 0; k < PIECES_PER_SCOOP; k++) {
        const n = i * PIECES_PER_SCOOP + k;
        const img = imgs[n];
        const v = BOTTOM_V - 10 - (k % 3) * 10 - i * 18 - hash(n) * 8;
        const span = halfWidthAt(v) - size / 2 - 4;
        const x = (((k * 0.37 + hash(n + 50) * 0.25) % 1) * 2 - 1) * span;
        const fresh = !img.visible || img.texture.key !== key;
        img.setTexture(key);
        img.setDisplaySize(size, (size * img.height) / img.width).setAngle(hash(n + 9) * 40 - 20).setVisible(true);
        if (fresh) {
          img.setPosition(x, lv(Math.min(surfaceV, v - 40)));
          this.scene.tweens.add({ targets: img, y: lv(v), duration: 380 + k * 40, ease: "Bounce.easeOut" });
        } else if (!this.scene.tweens.isTweening(img)) img.setPosition(x, lv(v));
      }
    });
  }

  private renderIce(scoops: number, surfaceV: number | null) {
    const imgs = this.pool(this.iceLayer, scoops * ICE_PER_SCOOP, "piece_ice");
    imgs.forEach((img, n) => {
      // Ice floats just under the surface; in an empty cup it rests on the bottom.
      const v =
        surfaceV === null ? BOTTOM_V - 28 - Math.floor(n / 4) * 30 : Math.min(BOTTOM_V - 28, surfaceV + 20 + (n % 3) * 14 + Math.floor(n / 3) * 10);
      const span = halfWidthAt(v) - 30;
      const x = (((n * 0.41 + 0.15) % 1) * 2 - 1) * span;
      img
        .setDisplaySize(52, (52 * img.height) / img.width)
        .setAngle(hash(n + 3) * 50 - 25)
        .setAlpha(0.9)
        .setPosition(x, lv(v))
        .setVisible(true);
    });
  }

  private drawGauge(cup: CupState, order: Order | undefined, hints: boolean) {
    const gauge = this.gauge;
    const toY = (v: number) => this.gaugeY(v);
    const gx = this.gaugeX();
    const top = toY(1.15) - 14;
    const bottom = toY(0) + 12;
    // gauge_tube (61×360): the glass inside spans x 4..57 and y 6..~345.
    this.tube.setPosition(gx, (top + bottom) / 2).setDisplaySize(28, bottom - top);
    const innerW = 28 * (49 / 61);
    let acc = 0;
    const band = (amount: number, color: number) => {
      if (amount <= 0) return;
      gauge.fillStyle(color, 0.92).fillRect(gx - innerW / 2, toY(acc + amount), innerW, toY(acc) - toY(acc + amount));
      acc += amount;
    };
    for (const t of TEA_IDS) band(cup.tea[t], INGREDIENTS[t].color);
    band(cup.milk, 0xf3e3c8);
    gauge.lineStyle(3, 0x2f6b2f, 1).lineBetween(gx - 18, toY(1), gx + 18, toY(1));
    if (order && hints) {
      const r = RECIPE_BY_ID[order.recipeId];
      if (r.milkRatio > 0) {
        gauge.lineStyle(3, INGREDIENTS[r.tea].color, 1);
        for (let dx = -18; dx < 18; dx += 8) gauge.lineBetween(gx + dx, toY(r.teaRatio), gx + dx + 5, toY(r.teaRatio));
      }
    }
  }
}
