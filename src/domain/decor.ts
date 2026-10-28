import type { ShopResult } from "./economy";
import type { SaveData, TilePos } from "./types";

export type DecorId = "decor_lanterns" | "decor_rug" | "decor_monstera" | "decor_painting" | "decor_plushies" | "decor_chalkboard";
export type DecorEffect = "tip" | "patience" | "spawn";

export interface DecorDef {
  id: DecorId;
  name: string;
  cost: number;
  effect: DecorEffect;
  /** Fraction, e.g. 0.04 = +4% tips / patience lasts 4% longer / customers arrive 4% sooner. */
  amount: number;
  description: string;
  minReputation?: number;
  /** Mochi's story stage (served visits) needed before the item is sold. */
  minRegularStage?: number;
  /** Unlock condition shown while locked. */
  lockText?: string;
}

export const DECOR: DecorDef[] = [
  { id: "decor_lanterns", name: "Đèn lồng giấy", cost: 140, effect: "tip", amount: 0.04, description: "Ánh đèn ấm áp: tiền tip tăng 4%." },
  { id: "decor_rug", name: "Thảm hình mèo", cost: 120, effect: "patience", amount: 0.05, description: "Êm chân: mèo khách kiên nhẫn hơn 5%." },
  { id: "decor_monstera", name: "Cây monstera", cost: 180, effect: "patience", amount: 0.05, description: "Góc xanh mát: mèo khách kiên nhẫn hơn 5%." },
  {
    id: "decor_painting",
    name: "Tranh Mochi vẽ",
    cost: 80,
    effect: "tip",
    amount: 0.03,
    description: "Bức tranh quán do Mochi tặng: tiền tip tăng 3%.",
    minRegularStage: 3,
    lockText: "Phục vụ Mochi 3 lần",
  },
  { id: "decor_plushies", name: "Kệ thú bông", cost: 220, effect: "spawn", amount: 0.04, description: "Dễ thương hút khách: khách đến nhanh hơn 4%.", minReputation: 30, lockText: "Cần 30 danh tiếng" },
  { id: "decor_chalkboard", name: "Bảng menu phấn", cost: 250, effect: "tip", amount: 0.05, description: "Menu vẽ tay xinh xắn: tiền tip tăng 5%.", minReputation: 40, lockText: "Cần 40 danh tiếng" },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d])) as Record<DecorId, DecorDef>;
export const isDecorId = (v: unknown): v is DecorId => typeof v === "string" && v in DECOR_BY_ID;

export function decorUnlocked(save: SaveData, d: DecorDef): boolean {
  return save.reputation >= (d.minReputation ?? 0) && save.regularStage >= (d.minRegularStage ?? 0);
}

export function buyDecor(save: SaveData, id: string): ShopResult {
  if (!isDecorId(id)) return { ok: false, reason: "Không tồn tại" };
  const d = DECOR_BY_ID[id];
  if (save.decor.includes(id)) return { ok: false, reason: "Đã sở hữu" };
  if (!decorUnlocked(save, d)) return { ok: false, reason: d.lockText ?? "Chưa mở khóa" };
  if (save.money < d.cost) return { ok: false, reason: "Không đủ xu" };
  save.money -= d.cost;
  save.decor.push(id);
  return { ok: true };
}

/** Size of the shop floor grid (tiles per side) a decor item can be saved at. */
export const ROOM_TILES = 10;

export const isTilePos = (v: unknown): v is TilePos =>
  typeof v === "object" && v !== null && [(v as TilePos).gx, (v as TilePos).gy].every((n) => Number.isInteger(n) && n >= 0 && n < ROOM_TILES);

/** Moves an owned item to a floor tile (which tiles are free is up to the room view). */
export function placeDecor(save: SaveData, id: string, pos: TilePos): ShopResult {
  if (!isDecorId(id) || !save.decor.includes(id)) return { ok: false, reason: "Chưa sở hữu" };
  if (!isTilePos(pos)) return { ok: false, reason: "Chỗ này không đặt được" };
  save.decorAt[id] = { gx: pos.gx, gy: pos.gy };
  return { ok: true };
}

/** Summed bonus of one effect over the owned decor. */
export function decorBonus(decor: readonly string[], effect: DecorEffect): number {
  return DECOR.reduce((sum, d) => (d.effect === effect && decor.includes(d.id) ? sum + d.amount : sum), 0);
}
