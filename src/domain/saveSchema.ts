import { INGREDIENTS, QUESTS, RECIPE_BY_ID, SAVE_VERSION, UPGRADES, defaultSave } from "./data";
import type { IngredientId, SaveData } from "./types";

const KEY = "boba-story-save";
const DEVICE_KEY = "boba-story-device";

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

export function loadLocal(): SaveData | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const text = localStorage.getItem(KEY);
    return text ? migrate(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

export function saveLocal(save: SaveData): boolean {
  try {
    save.updatedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Anonymous cloud-save identity: a random recovery code stored on this device. */
export function deviceCode(): string {
  try {
    let code = localStorage.getItem(DEVICE_KEY);
    if (!code || !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      code = generateCode();
      localStorage.setItem(DEVICE_KEY, code);
    }
    return code;
  } catch {
    return generateCode();
  }
}

export function setDeviceCode(code: string) {
  try {
    localStorage.setItem(DEVICE_KEY, code);
  } catch {
    /* ignore */
  }
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export async function cloudUpload(save: SaveData): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("/api/save", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: deviceCode(), save }),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, message: "Đã lưu lên đám mây" } : { ok: false, message: json.error ?? "Không thể lưu đám mây" };
  } catch {
    return { ok: false, message: "Không có kết nối mạng" };
  }
}

export async function cloudDownload(code: string): Promise<{ save: SaveData | null; message: string }> {
  try {
    const res = await fetch(`/api/save?code=${encodeURIComponent(code)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { save: null, message: json.error ?? "Không tìm thấy bản lưu" };
    const save = migrate(json.save);
    return save ? { save, message: "Đã tải bản lưu" } : { save: null, message: "Bản lưu bị lỗi" };
  } catch {
    return { save: null, message: "Không có kết nối mạng" };
  }
}
