import { INVENTORY_CAP } from "./catalog";
import type { Rng } from "./customers";
import type { IngredientId } from "./types";

/** Special guests: at most one visit each per day, rolled on a normal arrival. */
export type GuestId = "granny" | "tiktoker";

export const GRANNY_FROM_DAY = 2;
export const GRANNY_CHANCE = 0.07;
export const TIKTOKER_FROM_DAY = 4;
export const TIKTOKER_CHANCE = 0.06;
/** The TikToker only hears about shops that are known a little. */
export const TIKTOKER_MIN_REPUTATION = 15;

/** Quality the TikToker needs to post a glowing video. */
export const VIRAL_QUALITY = 80;
export const VIRAL = { reputation: 6, spawnMul: 0.55, duration: 60 } as const;
export const FLOP_REPUTATION = -5;
/** Extra reputation lost when the TikToker walks out on camera. */
export const TIKTOKER_WALKOUT_REPUTATION = -4;

/** The granny's thank-you gift when she likes her drink. */
export const GRANNY_GIFT = { ingredient: "top_boba", amount: 5, reputation: 2 } as const;
export const GRANNY_HAPPY_QUALITY = 60;

export function pickGuest(rng: Rng, day: number, reputation: number, seen: GuestId[]): GuestId | null {
  if (!seen.includes("tiktoker") && day >= TIKTOKER_FROM_DAY && reputation >= TIKTOKER_MIN_REPUTATION && rng() < TIKTOKER_CHANCE) return "tiktoker";
  if (!seen.includes("granny") && day >= GRANNY_FROM_DAY && rng() < GRANNY_CHANCE) return "granny";
  return null;
}

export type TiktokerResult =
  | { kind: "viral"; reputation: number; spawnMul: number; duration: number }
  | { kind: "meh"; reputation: 0 }
  | { kind: "flop"; reputation: number };

/** What the TikToker posts after tasting the drink. */
export function tiktokerVerdict(quality: number, wrongDrink: boolean): TiktokerResult {
  if (!wrongDrink && quality >= VIRAL_QUALITY) return { kind: "viral", ...VIRAL };
  if (wrongDrink || quality < 50) return { kind: "flop", reputation: FLOP_REPUTATION };
  return { kind: "meh", reputation: 0 };
}

/** Adds a gift to the stock without going over the shelf cap; returns how much fit. */
export function receiveGift(inventory: Record<IngredientId, number>, id: IngredientId, amount: number): number {
  const added = Math.max(0, Math.min(amount, INVENTORY_CAP - inventory[id]));
  inventory[id] += added;
  return added;
}
