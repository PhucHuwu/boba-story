import { ARCHETYPES, INGREDIENTS, INVENTORY_CAP, QUESTS, RECIPE_BY_ID, SIZE_PRICE_BONUS, UPGRADES } from "./data";
import type { ArchetypeId, IngredientId, Order, QualityResult, SaveData } from "./types";

export function orderPrice(order: Order): number {
  return RECIPE_BY_ID[order.recipeId].price + SIZE_PRICE_BONUS[order.size];
}

export interface Payment {
  price: number;
  tip: number;
  reputation: number;
}

/** Wrong drinks are not paid for; good drinks earn a tip scaled by quality. */
export function payment(order: Order, result: QualityResult, archetype: ArchetypeId, upgrades: string[]): Payment {
  const def = ARCHETYPES[archetype];
  const price = result.wrongDrink ? 0 : result.quality < 45 ? Math.round(orderPrice(order) * 0.5) : orderPrice(order);
  const bell = upgrades.includes("bell") ? 1.25 : 1;
  const tipBase = result.quality >= 60 ? ((result.quality - 60) / 40) * 0.3 * orderPrice(order) : 0;
  const tip = result.wrongDrink ? 0 : Math.round(tipBase * def.tipMul * bell);
  let reputation = result.quality >= 90 ? 2 : result.quality >= 70 ? 1 : result.quality >= 45 ? 0 : -2;
  if (reputation > 0 && upgrades.includes("bell")) reputation += 0.5;
  if (archetype === "picky" && result.quality >= 85) reputation += 1;
  return { price, tip, reputation };
}

export const LEAVE_REPUTATION_PENALTY = -2;

export function packCost(id: IngredientId): number {
  const def = INGREDIENTS[id];
  return def.unitCost * def.pack;
}

export type ShopResult = { ok: true } | { ok: false; reason: string };

export function buyIngredient(save: SaveData, id: IngredientId): ShopResult {
  const cost = packCost(id);
  if (save.money < cost) return { ok: false, reason: "Không đủ xu" };
  if (save.inventory[id] + INGREDIENTS[id].pack > INVENTORY_CAP) return { ok: false, reason: `Kho đầy (tối đa ${INVENTORY_CAP})` };
  save.money -= cost;
  save.inventory[id] += INGREDIENTS[id].pack;
  return { ok: true };
}

export function unlockRecipe(save: SaveData, recipeId: string): ShopResult {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return { ok: false, reason: "Không tồn tại" };
  if (save.unlockedRecipes.includes(recipeId)) return { ok: false, reason: "Đã mở khóa" };
  if (save.money < recipe.unlockCost) return { ok: false, reason: "Không đủ xu" };
  save.money -= recipe.unlockCost;
  save.unlockedRecipes.push(recipeId);
  return { ok: true };
}

export function buyUpgrade(save: SaveData, upgradeId: string): ShopResult {
  const up = UPGRADES.find((u) => u.id === upgradeId);
  if (!up) return { ok: false, reason: "Không tồn tại" };
  if (save.upgrades.includes(upgradeId)) return { ok: false, reason: "Đã sở hữu" };
  if (save.money < up.cost) return { ok: false, reason: "Không đủ xu" };
  save.money -= up.cost;
  save.upgrades.push(upgradeId);
  return { ok: true };
}

/** Recipes that can currently be made with the stock on hand (one portion each). */
export function canMake(save: SaveData, recipeId: string): boolean {
  const r = RECIPE_BY_ID[recipeId];
  const inv = save.inventory;
  if (inv.cup < 1 || inv.lid < 1 || inv[r.tea] < 1) return false;
  if (r.milkRatio > 0 && inv.milk < 1) return false;
  if (r.topping && inv[r.topping] < 1) return false;
  return true;
}

/** Bailout so the player can never get permanently stuck without money or stock. */
export function needsRecovery(save: SaveData): boolean {
  const cheapest = packCost("cup") + packCost("lid") + packCost("tea_green");
  const canServeAnything = save.unlockedRecipes.some((id) => canMake(save, id));
  return !canServeAnything && save.money < cheapest;
}

export const RECOVERY_GRANT = 80;

function metricValue(save: SaveData, metric: (typeof QUESTS)[number]["metric"]): number {
  switch (metric) {
    case "recipes":
      return save.unlockedRecipes.length;
    case "upgrades":
      return save.upgrades.length;
    case "reputation":
      return Math.floor(save.reputation);
    default:
      return save.stats[metric];
  }
}

/** Updates quest progress from stats. Returns quests that became complete in this call. */
export function refreshQuests(save: SaveData): string[] {
  const newlyDone: string[] = [];
  for (const q of QUESTS) {
    const p = save.quests[q.id] ?? (save.quests[q.id] = { progress: 0, done: false, claimed: false });
    p.progress = Math.min(q.target, metricValue(save, q.metric));
    if (!p.done && p.progress >= q.target) {
      p.done = true;
      newlyDone.push(q.id);
    }
  }
  return newlyDone;
}

export function claimQuest(save: SaveData, questId: string): number {
  const q = QUESTS.find((x) => x.id === questId);
  const p = save.quests[questId];
  if (!q || !p || !p.done || p.claimed) return 0;
  p.claimed = true;
  save.money += q.reward;
  return q.reward;
}
