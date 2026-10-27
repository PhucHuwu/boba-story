import { ARCHETYPES, DAY, RECIPE_BY_ID, REGULAR_FAVORITE } from "./catalog";
import { decorBonus } from "./decor";
import type { Delivery } from "./delivery";
import type { ArchetypeId, Level, Order, SaveData, Size } from "./types";

export type CustomerState = "approaching" | "ordering" | "waiting" | "receiving" | "leaving" | "gone";

const TRANSITIONS: Record<CustomerState, CustomerState[]> = {
  approaching: ["ordering", "leaving"],
  ordering: ["waiting", "leaving"],
  waiting: ["receiving", "leaving"],
  receiving: ["leaving"],
  leaving: ["gone"],
  gone: [],
};

export interface Customer {
  id: number;
  archetype: ArchetypeId;
  order: Order;
  state: CustomerState;
  patience: number;
  decay: number;
  slot: number;
  cancelled: boolean;
  line: string;
  /** Food critic: their review weighs triple. */
  critic: boolean;
  /** Delivery-app shipper picking up several cups (`order` is the cup currently being made). */
  delivery?: Delivery;
}

/** Enforces the lifecycle Approaching → Ordering → Waiting → Receiving → Leaving. */
export function transition(c: Customer, next: CustomerState): boolean {
  if (!TRANSITIONS[c.state].includes(next)) return false;
  c.state = next;
  return true;
}

export function isImpatient(c: Customer): boolean {
  return c.state === "waiting" && c.patience < 35;
}

/** Patience = max(0, 100 - decayRate * waitingTime). Returns true when patience just ran out. */
export function tickPatience(c: Customer, dtSec: number, relaxed: boolean): boolean {
  if (c.state !== "waiting" && c.state !== "ordering") return false;
  const rate = relaxed ? c.decay * 0.35 : c.decay;
  const before = c.patience;
  c.patience = Math.max(relaxed ? 15 : 0, c.patience - rate * dtSec);
  return before > 0 && c.patience <= 0;
}

export type Rng = () => number;

export function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

const LEVELS: Level[] = [0, 50, 100];

export function maxCustomers(save: SaveData): number {
  return save.upgrades.includes("wide_counter") ? 4 : 3;
}

export function hourAt(elapsedSec: number): number {
  return DAY.openHour + (elapsedSec / DAY.lengthSec) * (DAY.closeHour - DAY.openHour);
}

export function isPeak(hour: number): boolean {
  return DAY.peaks.some(([a, b]) => hour >= a && hour < b);
}

/** Seconds between arrivals: faster at peak hours and with higher reputation. */
export function spawnInterval(hour: number, reputation: number, day: number): number {
  const base = isPeak(hour) ? 9 : 17;
  const repFactor = 1 - Math.min(0.35, reputation / 200);
  const dayFactor = day <= 2 ? 1.3 : 1 - Math.min(0.3, (day - 2) * 0.03);
  return base * repFactor * dayFactor;
}

export interface OrderFactoryInput {
  rng: Rng;
  save: SaveData;
  archetype: ArchetypeId;
  id: number;
  /** Recipes we have stock for; falls back to any unlocked recipe. */
  makeable: string[];
  /** Ice levels to pick from (weather). */
  iceLevels?: Level[];
}

export function createOrder({ rng, save, archetype, id, makeable, iceLevels }: OrderFactoryInput): Order {
  const pool = makeable.length ? makeable : save.unlockedRecipes;
  let recipeId = pick(rng, pool);
  if (archetype === "regular" && pool.includes(REGULAR_FAVORITE)) recipeId = REGULAR_FAVORITE;
  if (archetype === "student" || archetype === "tiktoker") {
    const withTopping = pool.filter((r) => RECIPE_BY_ID[r].topping);
    if (withTopping.length && rng() < 0.7) recipeId = pick(rng, withTopping);
  }
  const easy = save.day <= 1 && !save.tutorialDone;
  const size: Size = easy || archetype === "granny" ? "M" : archetype === "tiktoker" || rng() < 0.3 ? "L" : "M";
  const sugar: Level = easy ? 50 : archetype === "granny" ? pick(rng, [0, 50] as Level[]) : archetype === "picky" ? pick(rng, LEVELS) : pick(rng, [50, 50, 100, 0] as Level[]);
  const ice: Level = easy ? 50 : archetype === "granny" ? pick(rng, [0, 50] as Level[]) : archetype === "picky" ? pick(rng, LEVELS) : pick(rng, iceLevels ?? ([50, 100, 100, 0] as Level[]));
  return { id, recipeId, size, sugar, ice };
}

export function chooseArchetype(rng: Rng, save: SaveData, regularServedToday: boolean, present: ArchetypeId[]): ArchetypeId {
  const options: ArchetypeId[] = ["student", "student", "office", "office"];
  if (save.reputation >= ARCHETYPES.picky.minReputation) options.push("picky");
  if (!regularServedToday && !present.includes("regular")) options.push("regular", "regular");
  return pick(rng, options);
}

export function createCustomer(id: number, archetype: ArchetypeId, order: Order, slot: number, upgrades: string[], line: string, decor: readonly string[] = []): Customer {
  const plants = (upgrades.includes("cozy_plants") ? 0.85 : 1) / (1 + decorBonus(decor, "patience"));
  return {
    id,
    archetype,
    order,
    state: "approaching",
    patience: 100,
    decay: ARCHETYPES[archetype].decay * plants,
    slot,
    cancelled: false,
    line,
    critic: false,
  };
}
