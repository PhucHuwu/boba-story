import type { ArchetypeId, DayStats, SaveData } from "./types";

export function emptyDayStats(): DayStats {
  return { revenue: 0, tips: 0, rewards: 0, spent: 0, served: 0, lost: 0, qualitySum: 0, perfect: 0, recipesServed: [], ingredientValueUsed: 0 };
}

export const PERFECT_QUALITY = 90;

export interface ServeRecord {
  price: number;
  tip: number;
  reputation: number;
  quality: number;
  recipeId: string;
  archetype: ArchetypeId;
}

/** Books a served drink into the save and the day's ledger. */
export function recordServe(save: SaveData, day: DayStats, r: ServeRecord) {
  const earned = r.price + r.tip;
  day.revenue += r.price;
  day.tips += r.tip;
  day.served++;
  day.qualitySum += r.quality;
  if (r.quality >= PERFECT_QUALITY) day.perfect++;
  if (!day.recipesServed.includes(r.recipeId)) day.recipesServed.push(r.recipeId);
  save.money += earned;
  save.reputation = clampRep(save.reputation + r.reputation);
  save.stats.served++;
  save.stats.totalEarned += earned;
  if (r.quality >= PERFECT_QUALITY) save.stats.perfect++;
  if (r.archetype === "regular") {
    save.stats.regularVisits++;
    save.regularStage++;
  }
  if (r.archetype === "picky" && r.quality >= 80) save.stats.pickyHappy++;
}

export function recordLost(save: SaveData, day: DayStats, reputationPenalty: number) {
  day.lost++;
  save.reputation = clampRep(save.reputation + reputationPenalty);
}

export function dayProfit(day: DayStats): number {
  return day.revenue + day.tips + day.rewards - day.ingredientValueUsed;
}

const clampRep = (v: number) => Math.max(0, Math.min(100, v));
