// Where each asset key lives under public/assets/ (and art-src/). Keys stay flat in code;
// only the file location is grouped. First matching rule wins.
const RULES = [
  [/^(bg_room|counter_front|worktop)$/, "scene"],
  [/^(tea_.*|milk|sugar|ice|top_.*|cup_stack|sealer|trash)$/, "stations"],
  [/^cat_/, "characters/customers"],
  [/^shipper_/, "characters/shippers"],
  [/^(npc_.*|robber|rival_dog)$/, "characters/npc"],
  [/^drink_/, "drinks"],
  [/^upg_/, "upgrades"],
  [/^(rival_.*|trash_.*)$/, "events"],
  [/^(icon_.*|coin|star)$/, "icons"],
  [/^(logo|app_icon)$/, "brand"],
];

export function assetFolder(key) {
  for (const [re, dir] of RULES) if (re.test(key)) return dir;
  return "misc";
}

/** Path relative to public/assets/ (or art-src/), without extension. */
export const assetPath = (key) => `${assetFolder(key)}/${key}`;
