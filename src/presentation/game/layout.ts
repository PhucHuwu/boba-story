/** Screen layout of the 720×1280 portrait game canvas. */
export const GAME_W = 720;
export const GAME_H = 1280;

export const COUNTER_Y = 640;
export const DOOR = { x: 470, y: 520 } as const;
export const CUP_POS = { x: 330, y: 1060 } as const;
export const CARD_Y = 215;
export const BUBBLE_Y = 360;
export const CAT_HEIGHT = 330;

export function slotX(slot: number, slots: number): number {
  return (slots === 4 ? [95, 270, 450, 625] : [125, 360, 595])[slot] ?? GAME_W / 2;
}

export const SHORT_RECIPE_NAME: Record<string, string> = {
  classic: "Trà sữa",
  boba: "TS trân châu",
  jasmine: "Trà xanh nhài",
  oolong_milk: "Ô long sữa",
  green_jelly: "TX sữa thạch",
  oolong_pudding: "Ô long pudding",
  black_jelly: "Hồng trà thạch",
};

export const COLORS = {
  bean: 0x4a2c1d,
  cocoa: 0x8a5a3b,
  paper: 0xfffaf2,
  selected: 0xfff2c9,
  caramel: 0xe08a3c,
  good: 0x7cc47f,
  warn: 0xf2b84b,
  bad: 0xe2665c,
  highlight: 0xffd54a,
} as const;
