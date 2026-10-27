// Where each asset key lives under public/assets/ (and art-src/). Keys stay flat in code;
// only the file location is grouped. First matching rule wins.
const RULES = [
  [/^(bg_room|counter_front|worktop)$/, "scene"],
  [/^(tea_.*|milk.*|sugar.*|ice.*|top_.*|cup_stack|sealer.*|trash|shaker.*)$/, "stations"],
  [/^cat_/, "characters/customers"],
  [/^shipper_/, "characters/shippers"],
  [/^(npc_.*|robber|rival_dog)$/, "characters/npc"],
  [/^drink_/, "drinks"],
  [/^upg_/, "upgrades"],
  [/^(rival_.*|trash_.*)$/, "events"],
  [/^(icon_.*|coin|star)$/, "icons"],
  [/^(cup_.*|liquid_.*|piece_.*|scoop_.*|pour_.*|fx_.*|gauge_.*)$/, "brewing"],
  [/^ui_/, "ui"],
  [/^(logo|app_icon)$/, "brand"],
  [/^landing_/, "landing"],
  [/^decor_/, "decor"],
  [/^acc_/, "characters/accessories"],
];

export function assetFolder(key) {
  for (const [re, dir] of RULES) if (re.test(key)) return dir;
  return "misc";
}

/** Path relative to public/assets/ (or art-src/), without extension. */
export const assetPath = (key) => `${assetFolder(key)}/${key}`;
