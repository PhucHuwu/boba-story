import type * as Phaser from "phaser";
import { INGREDIENTS, RECIPE_BY_ID, TEA_IDS } from "@/domain/catalog";
import { liquidTotal } from "@/domain/cup";
import type { CupState, Order } from "@/domain/types";
import { COLORS, type Point } from "./layout";

const MILK_COLOR = 0xfff4e2;
const MAX_LEVEL = 1.12;

function mixColor(cup: CupState, total: number): number {
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

/** Draws the cup being brewed plus the fill gauge with target markers. */
export function drawCup(
  g: Phaser.GameObjects.Graphics,
  gauge: Phaser.GameObjects.Graphics,
  pos: Point,
  cup: CupState | null,
  order: Order | undefined,
  hints: boolean,
) {
  g.clear();
  gauge.clear();
  const x = pos.x;
  const yBottom = pos.y + 95;

  g.fillStyle(0x6b4430, 0.18).fillEllipse(x, yBottom + 6, 170, 34);
  if (!cup) {
    g.lineStyle(3, COLORS.cocoa, 0.5).strokeEllipse(x, yBottom + 6, 150, 28);
    return;
  }
  const large = cup.size === "L";
  const topW = large ? 140 : 122;
  const botW = topW * 0.76;
  const h = large ? 200 : 175;
  const yTop = yBottom - h;
  const widthAt = (y: number) => botW + (topW - botW) * ((yBottom - y) / h);
  const fullY = yBottom - h * 0.86;
  const total = liquidTotal(cup);
  const liquidTopY = yBottom - (yBottom - fullY) * Math.min(total, MAX_LEVEL);

  if (total > 0.001) {
    const yl = Math.max(liquidTopY, yTop + 4);
    g.fillStyle(mixColor(cup, total), 0.95);
    g.beginPath();
    g.moveTo(x - botW / 2 + 4, yBottom - 4);
    g.lineTo(x + botW / 2 - 4, yBottom - 4);
    g.lineTo(x + widthAt(yl) / 2 - 4, yl);
    g.lineTo(x - widthAt(yl) / 2 + 4, yl);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 0.25).fillRect(x - widthAt(yl) / 2 + 6, yl, widthAt(yl) - 12, 5);
    if (cup.sugarPumps > 0) g.fillStyle(0xc77a2c, 0.35 + cup.sugarPumps * 0.1).fillRect(x - botW / 2 + 6, yBottom - 14, botW - 12, 10);
  }

  cup.toppings.forEach((t, i) => {
    for (let k = 0; k < 7; k++) {
      const px = x - botW / 2 + 14 + ((k * 37 + i * 13) % (botW - 28));
      const py = yBottom - 12 - ((k * 7 + i * 11) % 22) - i * 8;
      if (t === "top_boba") g.fillStyle(0x2e1a12, 1).fillCircle(px, py, 7);
      else if (t === "top_jelly") g.fillStyle(0x8fcf6b, 0.95).fillRect(px - 6, py - 6, 12, 12);
      else g.fillStyle(0xf3c64f, 1).fillRoundedRect(px - 8, py - 5, 16, 11, 4);
    }
  });

  const surface = total > 0.05 ? Math.max(liquidTopY, yTop + 10) : yBottom - 40;
  for (let i = 0; i < cup.iceScoops * 3; i++) {
    const px = x - 34 + ((i * 29) % 70);
    const py = surface + 10 + ((i * 17) % 34);
    g.fillStyle(0xeaf8ff, 0.85).fillRoundedRect(px - 9, py - 9, 18, 18, 4);
    g.lineStyle(1.5, 0x9cc7dc, 0.9).strokeRoundedRect(px - 9, py - 9, 18, 18, 4);
  }

  g.lineStyle(4, 0x6b4430, 1);
  g.beginPath();
  g.moveTo(x - topW / 2, yTop);
  g.lineTo(x - botW / 2, yBottom);
  g.lineTo(x + botW / 2, yBottom);
  g.lineTo(x + topW / 2, yTop);
  g.strokePath();
  g.fillStyle(0xffffff, 0.18).fillRect(x - topW / 2 + 10, yTop + 8, 10, h - 20);
  g.lineStyle(3, 0x6b4430, 1).strokeEllipse(x, yTop, topW, 14);

  if (cup.overflow) {
    g.fillStyle(COLORS.cocoa, 0.7);
    g.fillCircle(x - topW / 2 + 4, yTop + 20, 6).fillCircle(x + topW / 2 - 6, yTop + 40, 5).fillCircle(x - topW / 2 + 10, yTop + 55, 4);
  }

  if (cup.sealed) {
    g.fillStyle(0xf6c1d0, 0.95).fillEllipse(x, yTop, topW - 2, 14);
    g.fillStyle(0xffffff, 0.6).fillEllipse(x - 20, yTop - 2, 30, 4);
    g.fillStyle(COLORS.bad, 1).fillRect(x + 14, yTop - 70, 14, 74);
    g.fillStyle(0xffffff, 0.5).fillRect(x + 16, yTop - 70, 4, 74);
    g.lineStyle(2, 0x6b4430, 1).strokeRect(x + 14, yTop - 70, 14, 74);
  }

  // Gauge: stacked liquids, full line, and the recipe's tea mark.
  const gx = x + topW / 2 + 26;
  const gTop = fullY - 30;
  const toY = (v: number) => yBottom - (yBottom - fullY) * Math.min(v, 1.15);
  gauge.fillStyle(COLORS.paper, 0.95).fillRoundedRect(gx - 12, gTop - 8, 24, yBottom - gTop + 16, 10);
  gauge.lineStyle(2, COLORS.cocoa, 1).strokeRoundedRect(gx - 12, gTop - 8, 24, yBottom - gTop + 16, 10);
  let acc = 0;
  const band = (amount: number, color: number) => {
    if (amount <= 0) return;
    gauge.fillStyle(color, 1).fillRect(gx - 7, toY(acc + amount), 14, toY(acc) - toY(acc + amount));
    acc += amount;
  };
  for (const t of TEA_IDS) band(cup.tea[t], INGREDIENTS[t].color);
  band(cup.milk, 0xf3e3c8);
  gauge.lineStyle(3, 0x2f6b2f, 1).lineBetween(gx - 16, toY(1), gx + 16, toY(1));
  if (order && hints) {
    const r = RECIPE_BY_ID[order.recipeId];
    if (r.milkRatio > 0) {
      gauge.lineStyle(3, INGREDIENTS[r.tea].color, 1);
      for (let dx = -16; dx < 16; dx += 8) gauge.lineBetween(gx + dx, toY(r.teaRatio), gx + dx + 5, toY(r.teaRatio));
    }
  }
}
