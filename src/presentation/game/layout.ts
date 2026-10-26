import type { TeaId, ToppingId } from "@/domain/types";

export type StationId = TeaId | "milk" | "sugar" | "ice" | "cup_M" | "cup_L" | "sealer" | "trash" | ToppingId;

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  w: number;
  h: number;
}

/** Where a station sits and the box its sprite is fitted into. */
export interface StationSpot extends Rect {
  /** Optional y for the label (defaults to below the sprite box). */
  labelY?: number;
}

export type LayoutKind = "phone" | "tabletPortrait" | "landscape";

/**
 * Everything the shop view needs to place things on screen.
 * One object per form factor; the scene and the React overlays read the same values.
 */
export interface Layout {
  kind: LayoutKind;
  width: number;
  height: number;
  /** Customer area: the room behind the counter (x range) and the background placement. */
  room: { w: number; bgY: number };
  counterY: number;
  door: Point;
  cardY: number;
  bubbleY: number;
  catHeight: number;
  slots: { 3: number[]; 4: number[] };
  /** Wooden work surface where the stations live. */
  worktop: Rect;
  /** Optional counter-front panel under the room (landscape only). */
  counterFront?: Rect;
  /** Optional shelf/mat backings that visually group station rows (landscape only). */
  benchRows?: Rect[];
  ticket: Rect & { titleSize: number; textSize: number };
  cup: Point;
  stations: Record<StationId, StationSpot>;
  /** Tutorial hint bar (canvas units; React converts to %). */
  hint: { x: number; y: number; w: number };
}

const PHONE: Layout = {
  kind: "phone",
  width: 720,
  height: 1280,
  room: { w: 720, bgY: -250 },
  counterY: 640,
  door: { x: 470, y: 520 },
  cardY: 250,
  bubbleY: 375,
  catHeight: 330,
  slots: { 3: [125, 360, 595], 4: [95, 270, 450, 625] },
  worktop: { x: 0, y: 648, w: 720, h: 632 },
  ticket: { x: 12, y: 656, w: 696, h: 112, titleSize: 26, textSize: 20 },
  cup: { x: 330, y: 1060 },
  stations: {
    tea_black: { x: 68, y: 880, w: 112, h: 150 },
    tea_green: { x: 186, y: 880, w: 112, h: 150 },
    tea_oolong: { x: 304, y: 880, w: 112, h: 150 },
    milk: { x: 422, y: 886, w: 104, h: 130 },
    sugar: { x: 540, y: 880, w: 80, h: 140 },
    ice: { x: 650, y: 890, w: 120, h: 110 },
    cup_M: { x: 58, y: 1080, w: 70, h: 130 },
    cup_L: { x: 150, y: 1070, w: 84, h: 160 },
    sealer: { x: 545, y: 1066, w: 150, h: 160 },
    trash: { x: 670, y: 1100, w: 70, h: 100 },
    top_boba: { x: 130, y: 1197, w: 130, h: 80, labelY: 1239 },
    top_jelly: { x: 320, y: 1197, w: 130, h: 80, labelY: 1239 },
    top_pudding: { x: 510, y: 1197, w: 130, h: 80, labelY: 1239 },
  },
  hint: { x: 22, y: 563, w: 676 },
};

/** iPad portrait (~3:4): wider counter, roomier stations. */
const TABLET_PORTRAIT: Layout = {
  kind: "tabletPortrait",
  width: 960,
  height: 1340,
  room: { w: 960, bgY: -536 },
  counterY: 650,
  door: { x: 627, y: 491 },
  cardY: 225,
  bubbleY: 375,
  catHeight: 360,
  slots: { 3: [170, 480, 790], 4: [125, 355, 605, 835] },
  worktop: { x: 0, y: 658, w: 960, h: 682 },
  ticket: { x: 16, y: 668, w: 928, h: 108, titleSize: 28, textSize: 22 },
  cup: { x: 450, y: 1110 },
  // The gap in the top row (x ≈ 390–510) keeps the cup's straw clear of the station labels.
  stations: {
    tea_black: { x: 80, y: 880, w: 120, h: 160 },
    tea_green: { x: 205, y: 880, w: 120, h: 160 },
    tea_oolong: { x: 330, y: 880, w: 120, h: 160 },
    milk: { x: 575, y: 886, w: 112, h: 140 },
    sugar: { x: 700, y: 880, w: 88, h: 150 },
    ice: { x: 845, y: 890, w: 140, h: 120 },
    cup_M: { x: 80, y: 1110, w: 80, h: 140 },
    cup_L: { x: 190, y: 1100, w: 94, h: 170 },
    sealer: { x: 720, y: 1100, w: 170, h: 175 },
    trash: { x: 880, y: 1130, w: 80, h: 110 },
    top_boba: { x: 190, y: 1270, w: 140, h: 72, labelY: 1302 },
    top_jelly: { x: 450, y: 1270, w: 140, h: 72, labelY: 1302 },
    top_pudding: { x: 710, y: 1270, w: 140, h: 72, labelY: 1302 },
  },
  hint: { x: 40, y: 570, w: 880 },
};

/** iPad landscape (~4:3): customers on the left, brewing bench on the right. */
const LANDSCAPE: Layout = {
  kind: "landscape",
  width: 1600,
  height: 1150,
  room: { w: 820, bgY: -213 },
  counterY: 800,
  door: { x: 535, y: 664 },
  cardY: 300,
  bubbleY: 450,
  catHeight: 420,
  slots: { 3: [140, 410, 680], 4: [110, 310, 510, 710] },
  worktop: { x: 820, y: 0, w: 780, h: 1150 },
  counterFront: { x: 0, y: 808, w: 820, h: 342 },
  benchRows: [
    { x: 840, y: 110, w: 740, h: 300 },
    { x: 840, y: 500, w: 740, h: 300 },
    { x: 840, y: 880, w: 740, h: 190 },
  ],
  ticket: { x: 20, y: 850, w: 780, h: 230, titleSize: 36, textSize: 29 },
  cup: { x: 1190, y: 630 },
  stations: {
    tea_black: { x: 900, y: 235, w: 120, h: 190 },
    tea_green: { x: 1030, y: 235, w: 120, h: 190 },
    tea_oolong: { x: 1160, y: 235, w: 120, h: 190 },
    milk: { x: 1290, y: 245, w: 115, h: 165 },
    sugar: { x: 1410, y: 235, w: 95, h: 180 },
    ice: { x: 1530, y: 250, w: 125, h: 130 },
    cup_M: { x: 885, y: 640, w: 85, h: 160 },
    cup_L: { x: 990, y: 630, w: 100, h: 190 },
    sealer: { x: 1420, y: 620, w: 175, h: 195 },
    trash: { x: 1555, y: 670, w: 80, h: 115 },
    top_boba: { x: 960, y: 975, w: 190, h: 115, labelY: 1040 },
    top_jelly: { x: 1185, y: 975, w: 190, h: 115, labelY: 1040 },
    top_pudding: { x: 1410, y: 975, w: 190, h: 115, labelY: 1040 },
  },
  hint: { x: 30, y: 700, w: 760 },
};

export const LAYOUTS: Record<LayoutKind, Layout> = { phone: PHONE, tabletPortrait: TABLET_PORTRAIT, landscape: LANDSCAPE };

/** Picks the layout whose aspect ratio best fits the viewport. */
export function pickLayoutKind(viewportW: number, viewportH: number): LayoutKind {
  const aspect = viewportW / Math.max(1, viewportH);
  if (aspect >= 1.1) return "landscape";
  if (aspect >= 0.64) return "tabletPortrait";
  return "phone";
}

export function slotX(L: Layout, slot: number, slots: number): number {
  return (slots === 4 ? L.slots[4] : L.slots[3])[slot] ?? L.room.w / 2;
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
