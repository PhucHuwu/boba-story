import { TEA_IDS } from "./data";
import type { CupState, IngredientId, Size, TeaId, ToppingId } from "./types";

/** Volume at which the cup visibly overflows. */
export const OVERFLOW_AT = 1.08;
export const MAX_TOPPINGS = 3;
export const MAX_PUMPS = 4;
export const MAX_SCOOPS = 3;

export function newCup(size: Size): CupState {
  return {
    size,
    tea: { tea_black: 0, tea_green: 0, tea_oolong: 0 },
    milk: 0,
    sugarPumps: 0,
    iceScoops: 0,
    toppings: [],
    sealed: false,
    overflow: false,
    charged: ["cup"],
  };
}

export function liquidTotal(cup: CupState): number {
  return TEA_IDS.reduce((s, t) => s + cup.tea[t], 0) + cup.milk;
}

/**
 * Inventory is charged once per ingredient per cup for liquids (the first drop uses one portion),
 * and once per action for discrete additions (each sugar pump, ice scoop, topping spoon, lid).
 * `consume` returns false when the ingredient is out of stock.
 */
export type Consume = (id: IngredientId) => boolean;

export type ActionResult = { ok: true } | { ok: false; reason: "sealed" | "empty_stock" | "full" | "limit" };

function chargeOnce(cup: CupState, id: IngredientId, consume: Consume): boolean {
  if (cup.charged.includes(id)) return true;
  if (!consume(id)) return false;
  cup.charged.push(id);
  return true;
}

export function pour(cup: CupState, source: TeaId | "milk", amount: number, consume: Consume): ActionResult {
  if (cup.sealed) return { ok: false, reason: "sealed" };
  if (liquidTotal(cup) >= OVERFLOW_AT + 0.05) return { ok: false, reason: "full" };
  if (!chargeOnce(cup, source, consume)) return { ok: false, reason: "empty_stock" };
  if (source === "milk") cup.milk += amount;
  else cup.tea[source] += amount;
  if (liquidTotal(cup) > OVERFLOW_AT) cup.overflow = true;
  return { ok: true };
}

export function addSugar(cup: CupState, consume: Consume): ActionResult {
  if (cup.sealed) return { ok: false, reason: "sealed" };
  if (cup.sugarPumps >= MAX_PUMPS) return { ok: false, reason: "limit" };
  if (!consume("sugar")) return { ok: false, reason: "empty_stock" };
  cup.sugarPumps++;
  return { ok: true };
}

export function addIce(cup: CupState, consume: Consume): ActionResult {
  if (cup.sealed) return { ok: false, reason: "sealed" };
  if (cup.iceScoops >= MAX_SCOOPS) return { ok: false, reason: "limit" };
  if (!consume("ice")) return { ok: false, reason: "empty_stock" };
  cup.iceScoops++;
  return { ok: true };
}

export function addTopping(cup: CupState, topping: ToppingId, consume: Consume): ActionResult {
  if (cup.sealed) return { ok: false, reason: "sealed" };
  if (cup.toppings.length >= MAX_TOPPINGS) return { ok: false, reason: "limit" };
  if (!consume(topping)) return { ok: false, reason: "empty_stock" };
  cup.toppings.push(topping);
  return { ok: true };
}

export function seal(cup: CupState, consume: Consume): ActionResult {
  if (cup.sealed) return { ok: false, reason: "sealed" };
  if (!consume("lid")) return { ok: false, reason: "empty_stock" };
  cup.sealed = true;
  return { ok: true };
}

/** Dominant tea in the cup, or null when there is no tea. */
export function mainTea(cup: CupState): TeaId | null {
  let best: TeaId | null = null;
  for (const t of TEA_IDS) if (cup.tea[t] > 0.001 && (!best || cup.tea[t] > cup.tea[best])) best = t;
  return best;
}
