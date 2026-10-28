/**
 * Which images the scene needs before the shop opens and which can stream in afterwards.
 * Deferred art is only ever looked up through `textures.exists` (cat looks, blinks, accessories, decor) or shown
 * by React `<img>` tags (UI-only art), so a late arrival just means the fallback is used for a moment.
 */
const SKIP = [/^landing_/, /^app_icon$/];
/** Art of the other room style (2D close-up vs 2.5D isometric), never shown in this session. */
const SKIP_STYLE = { iso: [/^bg_room$/, /^decor_/], flat: [/^iso_/] };

/** Background order: guests that can walk in on day one first, then looks, then UI-only art. */
const DEFERRED: RegExp[] = [
  /^(shipper_[a-z]+|cat_granny|cat_tiktoker)_(?!blink)/,
  /^cat_[a-z]+_v\d+_(?!blink)/,
  /^acc_/,
  /_blink$/,
  /^(iso_)?decor_/,
  /^(rival_|robber$|npc_(?!stray_happy$)|upg_|logo$|icon_(?!combo$|critic$|delivery$))/,
];

export interface AssetPlan {
  critical: string[];
  /** In load order. */
  deferred: string[];
}

export function planAssets(keys: string[], owned: readonly string[] = [], style: "iso" | "flat" = "flat"): AssetPlan {
  const critical: string[] = [];
  const tiers: string[][] = DEFERRED.map(() => []);
  const skip = [...SKIP, ...SKIP_STYLE[style]];
  for (const key of keys) {
    if (skip.some((r) => r.test(key))) continue;
    const tier = owned.includes(key.replace(/^iso_/, "").replace(/_[lr]$/, "")) ? -1 : DEFERRED.findIndex((r) => r.test(key));
    (tier < 0 ? critical : tiers[tier]).push(key);
  }
  return { critical, deferred: tiers.flat() };
}
