import { LEVEL_UNITS, RECIPE_BY_ID, TEA_IDS } from "./catalog";
import { liquidTotal, mainTea } from "./cup";
import type { CupState, Order, QualityResult } from "./types";

/** Process points lost when a shaken recipe is served without shaking. */
export const SKIPPED_SHAKE = 30;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Score 100 inside tolerance, then falls off linearly to 0 at `zeroAt`. */
function closeness(error: number, tolerance: number, zeroAt: number): number {
  const e = Math.abs(error);
  if (e <= tolerance) return 100;
  if (e >= zeroAt) return 0;
  return 100 * (1 - (e - tolerance) / (zeroAt - tolerance));
}

export interface EvaluateInput {
  cup: CupState;
  order: Order;
  /** Patience left when served (0..100). */
  patience: number;
  /** Strictness multiplier from the customer archetype (lower = stricter). */
  tolerance?: number;
}

/**
 * Quality = 0.35 * RecipeAccuracy + 0.25 * OrderMatch + 0.20 * Process + 0.20 * Speed.
 * A drink with the wrong base tea is capped so that speed can never rescue a wrong drink.
 */
export function evaluate({ cup, order, patience, tolerance = 1 }: EvaluateInput): QualityResult {
  const recipe = RECIPE_BY_ID[order.recipeId];
  const notes: string[] = [];
  const total = liquidTotal(cup);
  const tea = mainTea(cup);
  const teaAmount = TEA_IDS.reduce((s, t) => s + cup.tea[t], 0);
  const wrongTeaAmount = TEA_IDS.filter((t) => t !== recipe.tea).reduce((s, t) => s + cup.tea[t], 0);
  const wrongDrink = tea !== recipe.tea || (recipe.topping !== null && !cup.toppings.includes(recipe.topping));

  // Recipe accuracy: fill level, tea/milk ratio, purity of the tea base.
  const fill = closeness(total - 1, 0.07 * tolerance, 0.45);
  const ratio = total > 0 ? teaAmount / total : 0;
  const ratioScore = recipe.milkRatio === 0 ? closeness(cup.milk / Math.max(total, 0.01), 0.04 * tolerance, 0.3) : closeness(ratio - recipe.teaRatio, 0.08 * tolerance, 0.4);
  const purity = teaAmount > 0 ? clamp(100 - (wrongTeaAmount / teaAmount) * 250) : 0;
  const recipeAccuracy = clamp(fill * 0.35 + ratioScore * 0.4 + purity * 0.25);
  if (fill < 70) notes.push(total < 1 ? "Ly hơi vơi" : "Rót quá đầy");
  if (ratioScore < 70) notes.push(recipe.milkRatio === 0 ? "Món này không cần sữa" : "Tỷ lệ trà/sữa chưa chuẩn");
  if (purity < 80 && teaAmount > 0) notes.push("Lẫn loại trà khác");

  // Order match: base tea, topping, sugar and ice levels, size.
  let orderMatch = 0;
  orderMatch += tea === recipe.tea ? 35 : 0;
  const wantTopping = recipe.topping;
  const hasWanted = wantTopping ? cup.toppings.filter((t) => t === wantTopping).length : 0;
  const extraToppings = cup.toppings.filter((t) => t !== wantTopping).length;
  if (wantTopping) orderMatch += hasWanted > 0 ? 25 - Math.max(0, hasWanted - 2) * 5 : 0;
  else orderMatch += 25;
  orderMatch -= extraToppings * 12;
  const sugarDiff = Math.abs(cup.sugarPumps - LEVEL_UNITS[order.sugar]);
  const iceDiff = Math.abs(cup.iceScoops - LEVEL_UNITS[order.ice]);
  orderMatch += sugarDiff === 0 ? 20 : sugarDiff === 1 ? 8 : 0;
  orderMatch += iceDiff === 0 ? 15 : iceDiff === 1 ? 6 : 0;
  orderMatch += cup.size === order.size ? 5 : 0;
  orderMatch = clamp(orderMatch);
  if (tea !== recipe.tea) notes.push("Sai loại trà");
  if (wantTopping && hasWanted === 0) notes.push("Thiếu topping");
  if (extraToppings > 0) notes.push("Thừa topping");
  if (sugarDiff > 0) notes.push("Độ ngọt chưa đúng");
  if (iceDiff > 0) notes.push("Lượng đá chưa đúng");
  if (cup.size !== order.size) notes.push("Sai size ly");

  // Process: shaken when the recipe asks for it, sealed, no spill.
  let process = 100;
  if (recipe.shake && !cup.shaken) {
    process -= SKIPPED_SHAKE;
    notes.push("Chưa lắc đều");
  }
  if (!cup.sealed) {
    process -= 60;
    notes.push("Chưa dán nắp");
  }
  if (cup.overflow) {
    process -= 40;
    notes.push("Bị tràn ly");
  }
  process = clamp(process);

  const speed = clamp(patience);

  let quality = 0.35 * recipeAccuracy + 0.25 * orderMatch + 0.2 * process + 0.2 * speed;
  if (wrongDrink) quality = Math.min(quality, 35);
  quality = Math.round(clamp(quality));

  return {
    quality,
    recipeAccuracy: Math.round(recipeAccuracy),
    orderMatch: Math.round(orderMatch),
    process: Math.round(process),
    speed: Math.round(speed),
    wrongDrink,
    notes,
  };
}

export function grade(quality: number): { label: string; stars: number } {
  if (quality >= 90) return { label: "Hoàn hảo!", stars: 3 };
  if (quality >= 70) return { label: "Ngon lắm", stars: 2 };
  if (quality >= 45) return { label: "Tạm được", stars: 1 };
  return { label: "Chưa ổn", stars: 0 };
}
