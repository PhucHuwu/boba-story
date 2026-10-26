import { INGREDIENTS, QUESTS, RECIPE_BY_ID, SAVE_VERSION, UPGRADES, defaultSave } from "./catalog";
import type { DayPlan, GoalKind, IngredientId, Loan, Review, RivalEventId, SaveData, WeatherId } from "./types";
import { REVIEW_KEEP } from "./reviews";

const WEATHERS: WeatherId[] = ["sunny", "hot", "rainy", "cloudy", "festival"];
const GOALS: GoalKind[] = ["served", "perfect", "noLost", "avgStars", "combo"];
const RIVALS: RivalEventId[] = ["discount", "trash", "fakeReviews", "powerCut", "karaoke"];
const ARCHS = ["student", "office", "regular", "picky", "shipper", "granny", "tiktoker"] as const;

function parseReviews(v: unknown): Review[] {
  if (!Array.isArray(v)) return [];
  const out: Review[] = [];
  for (const r of v.slice(-REVIEW_KEEP)) {
    if (!isObj(r) || typeof r.text !== "string" || !ARCHS.includes(r.archetype as (typeof ARCHS)[number])) continue;
    out.push({
      id: Math.floor(num(r.id, 0, 0)),
      day: Math.floor(num(r.day, 1, 1)),
      stars: Math.round(num(r.stars, 3, 1, 5)),
      text: r.text.slice(0, 200),
      archetype: r.archetype as Review["archetype"],
      ...(r.fake === true ? { fake: true } : {}),
      ...(r.critic === true ? { critic: true } : {}),
    });
  }
  return out;
}

function parsePlan(v: unknown): DayPlan | null {
  if (!isObj(v) || !isObj(v.goal)) return null;
  const weather = v.weather as WeatherId;
  const kind = v.goal.kind as GoalKind;
  if (!WEATHERS.includes(weather) || !GOALS.includes(kind)) return null;
  const rival = RIVALS.includes(v.rival as RivalEventId) ? (v.rival as RivalEventId) : null;
  return {
    day: Math.floor(num(v.day, 1, 1)),
    weather,
    goal: { kind, target: num(v.goal.target, 1, 0, 100), reward: Math.floor(num(v.goal.reward, 0, 0, 1000)) },
    rival,
    rivalAt: num(v.rivalAt, 0.4, 0, 1),
    visitor: v.visitor === "lottery" || v.visitor === "stray" ? v.visitor : null,
    visitorDone: v.visitorDone === true,
  };
}

function parseLoan(v: unknown): Loan | null {
  if (!isObj(v)) return null;
  const remaining = Math.floor(num(v.remaining, 0, 0, 1e6));
  return remaining > 0 ? { remaining, installment: Math.max(1, Math.floor(num(v.installment, remaining, 1, 1e6))) } : null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

/** Migrates and sanitizes untrusted save data. Returns null when the data is unusable. */
export function migrate(raw: unknown): SaveData | null {
  if (!isObj(raw)) return null;
  const version = num(raw.version, 0);
  if (version < 1 || version > SAVE_VERSION) return null;
  const base = defaultSave();
  const inv = isObj(raw.inventory) ? raw.inventory : {};
  const inventory = { ...base.inventory };
  for (const id of Object.keys(INGREDIENTS) as IngredientId[]) inventory[id] = Math.floor(num(inv[id], base.inventory[id], 0, 999));
  const unlocked = Array.isArray(raw.unlockedRecipes) ? raw.unlockedRecipes.filter((r): r is string => typeof r === "string" && !!RECIPE_BY_ID[r]) : [];
  const upgrades = Array.isArray(raw.upgrades) ? raw.upgrades.filter((u): u is string => typeof u === "string" && UPGRADES.some((x) => x.id === u)) : [];
  const quests = { ...base.quests };
  if (isObj(raw.quests)) {
    for (const q of QUESTS) {
      const p = raw.quests[q.id];
      if (isObj(p)) quests[q.id] = { progress: num(p.progress, 0, 0), done: p.done === true, claimed: p.claimed === true };
    }
  }
  const stats = { ...base.stats };
  if (isObj(raw.stats)) for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = num(raw.stats[k], 0, 0);
  const settings = { ...base.settings };
  if (isObj(raw.settings)) {
    settings.music = num(raw.settings.music, settings.music, 0, 1);
    settings.sfx = num(raw.settings.sfx, settings.sfx, 0, 1);
    settings.reducedMotion = raw.settings.reducedMotion === true;
    settings.relaxed = raw.settings.relaxed === true;
    settings.hints = raw.settings.hints !== false;
  }
  const reviews = parseReviews(raw.reviews);
  return {
    version: SAVE_VERSION,
    day: Math.floor(num(raw.day, 1, 1, 9999)),
    money: Math.floor(num(raw.money, base.money, 0, 1e7)),
    reputation: num(raw.reputation, base.reputation, 0, 100),
    inventory,
    unlockedRecipes: Array.from(new Set([...base.unlockedRecipes, ...unlocked])),
    upgrades: Array.from(new Set(upgrades)),
    quests,
    stats,
    settings,
    tutorialDone: raw.tutorialDone === true,
    regularStage: Math.floor(num(raw.regularStage, 0, 0, 99)),
    bank: Math.floor(num(raw.bank, 0, 0, 1e7)),
    loan: parseLoan(raw.loan),
    reviews,
    nextReviewId: Math.max(Math.floor(num(raw.nextReviewId, 1, 1)), ...reviews.map((r) => r.id + 1)),
    plan: parsePlan(raw.plan),
    lastRobberyDay: Math.floor(num(raw.lastRobberyDay, 0, 0)),
    nightPending: raw.nightPending === true,
    overdue: Math.floor(num(raw.overdue, 0, 0, 1e6)),
    taxBase: Math.floor(num(raw.taxBase, 0, 0, 1e7)),
    lotteryDay: Math.floor(num(raw.lotteryDay, 0, 0, 9999)),
    strayFed: Math.floor(num(raw.strayFed, 0, 0, 99)),
    updatedAt: num(raw.updatedAt, Date.now()),
  };
}

/** Anonymous cloud-save identity, e.g. `K7QM-2XPA-9DNE`. */
export const RECOVERY_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeRecoveryCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return RECOVERY_CODE_RE.test(code) ? code : null;
}

export function generateRecoveryCode(randomBytes: (n: number) => Uint8Array): string {
  const chars = Array.from(randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}
