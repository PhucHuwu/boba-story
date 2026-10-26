import type { Rng } from "./customers";
import type { MorningVisitor, SaveData } from "./types";

/** Morning visitors drop by the prep screen (at most one per day, never on the tutorial day). */
export const LOTTERY_FROM_DAY = 3;
export const LOTTERY_CHANCE = 0.3;
export const STRAY_FROM_DAY = 2;
export const STRAY_CHANCE = 0.3;

export function pickVisitor(save: SaveData, day: number, rng: Rng): MorningVisitor | null {
  if (!save.tutorialDone) return null;
  const r = rng();
  if (day >= LOTTERY_FROM_DAY && r < LOTTERY_CHANCE) return "lottery";
  if (save.strayFed < STRAY_ADOPT && day >= STRAY_FROM_DAY && r >= 1 - STRAY_CHANCE) return "stray";
  return null;
}

/** One ticket a day; the draw happens when the shop closes. Expected value is below the price, like a real lottery. */
export const LOTTERY_PRICE = 10;
export const LOTTERY_PRIZES = [
  { chance: 1 / 250, amount: 1000, label: "Trúng giải đặc biệt" },
  { chance: 1 / 40, amount: 60, label: "Trúng giải ba" },
  { chance: 1 / 10, amount: 10, label: "Trúng giải khuyến khích (hoàn vé)" },
] as const;

export interface LotteryResult {
  amount: number;
  label: string;
}

export function drawLottery(rng: Rng): LotteryResult {
  let r = rng();
  for (const p of LOTTERY_PRIZES) {
    if (r < p.chance) return { amount: p.amount, label: p.label };
    r -= p.chance;
  }
  return { amount: 0, label: "Trượt rồi, mai thử lại" };
}

export function buyLottery(save: SaveData): boolean {
  const plan = save.plan;
  if (!plan || plan.day !== save.day || plan.visitor !== "lottery" || plan.visitorDone || save.money < LOTTERY_PRICE) return false;
  save.money -= LOTTERY_PRICE;
  save.lotteryDay = save.day;
  plan.visitorDone = true;
  return true;
}

/** Feeding the stray kitten costs one portion of milk; after STRAY_ADOPT meals it stays as the shop cat. */
export const STRAY_ADOPT = 5;
export const STRAY_FEED_REPUTATION = 1;
/** The shop cat draws passers-by: time between arrivals is multiplied by this. */
export const SHOP_CAT_SPAWN_MUL = 0.95;

export function hasShopCat(save: SaveData): boolean {
  return save.strayFed >= STRAY_ADOPT;
}

export function feedStray(save: SaveData): boolean {
  const plan = save.plan;
  if (!plan || plan.day !== save.day || plan.visitor !== "stray" || plan.visitorDone || save.inventory.milk < 1) return false;
  save.inventory.milk -= 1;
  save.strayFed = Math.min(STRAY_ADOPT, save.strayFed + 1);
  save.reputation = Math.min(100, save.reputation + STRAY_FEED_REPUTATION);
  plan.visitorDone = true;
  return true;
}
