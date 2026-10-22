import { INGREDIENTS, QUESTS, RECIPE_BY_ID, SAVE_VERSION, UPGRADES, defaultSave } from "./catalog";
import type { IngredientId, SaveData } from "./types";

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
