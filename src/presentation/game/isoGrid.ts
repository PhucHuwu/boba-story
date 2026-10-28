import { type DecorId, isDecorId, ROOM_TILES } from "@/domain/decor";
import type { TilePos } from "@/domain/types";
import type { Layout, Point } from "./layout";

/**
 * 2.5D room geometry. `iso_room` is a square image of an empty room: two back walls meeting at the top centre and a
 * plank floor filling the rest. Positions are kept in that image's pixels (1024²) and mapped to the canvas with
 * `fitRoom`, so props stay glued to the same spot of the room on every layout.
 */
export const ROOM_IMAGE = 1024;
/** Where the two back walls meet the floor (measured on the art). */
export const FLOOR_ORIGIN: Point = { x: 507, y: 354 };
/** Floor tile size in image px: width across, height along the walls' slopes (the art is not an exact 2:1 iso). */
export const TILE = { w: 160, h: 80 };
/**
 * One tile step along each grid axis, following the two back walls as drawn: gx runs down the back-right wall
 * (slope 0.545), gy down the back-left wall (slope 0.492).
 */
export const AXIS_X: Point = { x: TILE.w / 2, y: (TILE.w / 2) * 0.545 };
export const AXIS_Y: Point = { x: -TILE.w / 2, y: (TILE.w / 2) * 0.492 };
/** Foot of the entrance door on the back-right wall. */
export const DOOR_FOOT: Point = { x: 730, y: 515 };

/** Image point of grid coordinates (gx, gy); the corner of tile (gx, gy) nearest the walls is at integer values. */
export function gridToImage(gx: number, gy: number): Point {
  return { x: FLOOR_ORIGIN.x + gx * AXIS_X.x + gy * AXIS_Y.x, y: FLOOR_ORIGIN.y + gx * AXIS_X.y + gy * AXIS_Y.y };
}

/** Centre of floor tile (gx, gy) in image px; gx runs along the back-right wall, gy along the back-left wall. */
export function tileToImage(gx: number, gy: number): Point {
  return gridToImage(gx + 0.5, gy + 0.5);
}

/** Grid coordinates (fractional) of an image point: inverse of gridToImage. */
export function imageToGrid(p: Point): Point {
  const dx = p.x - FLOOR_ORIGIN.x;
  const dy = p.y - FLOOR_ORIGIN.y;
  const det = AXIS_X.x * AXIS_Y.y - AXIS_Y.x * AXIS_X.y;
  return { x: (dx * AXIS_Y.y - dy * AXIS_Y.x) / det, y: (dy * AXIS_X.x - dx * AXIS_X.y) / det };
}

/** Floor tile under an image point (inverse of tileToImage). */
export function imageToTile(p: Point): { gx: number; gy: number } {
  const g = imageToGrid(p);
  return { gx: Math.floor(g.x), gy: Math.floor(g.y) };
}

export interface RoomFit {
  x: number;
  y: number;
  /** Displayed size of the square room image. */
  size: number;
  /** Canvas px per image px. */
  k: number;
}

/** Wall corner target height on the canvas: high enough to show both walls, below the HUD. */
const CORNER_Y = 200;

/** Places the room image so it covers the room area down to below the counter, with the wall corner near the top. */
export function fitRoom(L: Pick<Layout, "room" | "counterY">): RoomFit {
  const bottom = L.counterY + 40;
  const size = Math.max(L.room.w, bottom);
  const k = size / ROOM_IMAGE;
  const y = Math.min(0, Math.max(bottom - size, CORNER_Y - FLOOR_ORIGIN.y * k));
  return { x: (L.room.w - size) / 2, y, size, k };
}

export const toCanvas = (fit: RoomFit, p: Point): Point => ({ x: fit.x + p.x * fit.k, y: fit.y + p.y * fit.k });

/** Customers in the 2.5D room are drawn smaller than in the close-up 2D view. */
export const ISO_CAT_SCALE = 0.66;
/** Displayed height of the front counter (canvas px), its bottom just under the worktop edge. */
export const ISO_COUNTER_H = 100;
/** Customers' feet relative to counterY: behind the counter, so its top hides their feet. */
export const ISO_FOOT_OFFSET = -40;

/** The same layout with cats sized for the room and the door taken from the room art. */
export function isoLayout(L: Layout): Layout {
  return { ...L, catHeight: Math.round(L.catHeight * ISO_CAT_SCALE), door: toCanvas(fitRoom(L), DOOR_FOOT) };
}

/**
 * How a prop stands in the room. `floor` props are y-sorted with the customers by their foot; `wall` props hang on a
 * back wall and `flat` ones lie on the floor, both always behind anyone standing.
 */
export interface Prop {
  key: string;
  /** Anchor in image px: the foot for floor props, the centre for wall/flat props, the top for hanging ones. */
  at: Point;
  /** Displayed width in image px. */
  w: number;
  kind: "floor" | "wall" | "flat" | "hanging";
}

/** Tile of the little table (a fixed piece of furniture decor can't stand on). */
const TABLE_TILE: TilePos = { gx: 3, gy: 6 };

/** Furniture every shop has. */
export const ROOM_PROPS: Prop[] = [
  { key: "iso_shelf", at: { x: 110, y: 400 }, w: 190, kind: "wall" },
  { key: "iso_table", at: { x: tileToImage(TABLE_TILE.gx, TABLE_TILE.gy).x, y: tileToImage(TABLE_TILE.gx, TABLE_TILE.gy).y + TILE.h * 0.3 }, w: 250, kind: "floor" },
];

/** A floor prop stands a little in front of its tile centre so it reads as being on that tile. */
const FOOT_DY = TILE.h * 0.3;

/** Tiles per side an item covers (the rug lies over a 2×2 block, anchored at its back tile). */
const SPAN: Partial<Record<DecorId, number>> = { decor_rug: 2 };
export const decorSpan = (id: DecorId) => SPAN[id] ?? 1;

/** Image point of an item standing (floor) or lying (flat) on the block whose back tile is `t`. */
function tileAnchor(id: DecorId, kind: Prop["kind"], t: TilePos): Point {
  const half = (decorSpan(id) - 1) / 2;
  const c = tileToImage(t.gx + half, t.gy + half);
  return kind === "flat" ? c : { x: c.x, y: c.y + FOOT_DY };
}

/** Back tile of the block an item at image point `p` (as from tileAnchor) sits on. */
export function anchorToTile(id: DecorId, p: Point): TilePos {
  const half = (decorSpan(id) - 1) / 2;
  const kind = ISO_DECOR_ART[id].kind;
  const c = { x: p.x, y: p.y - (kind === "flat" ? 0 : FOOT_DY) - half * (AXIS_X.y + AXIS_Y.y) };
  return imageToTile(c);
}

/** Default tiles of the items that stand or lie on the floor (all inside placeableTiles). */
export const DEFAULT_TILES: Partial<Record<DecorId, TilePos>> = {
  decor_rug: { gx: 2, gy: 2 },
  decor_plushies: { gx: 0, gy: 2 },
  decor_monstera: { gx: 5, gy: 2 },
  decor_chalkboard: { gx: 1, gy: 0 },
};

const ISO_DECOR_ART: Record<DecorId, Omit<Prop, "at"> & { at?: Point }> = {
  decor_rug: { key: "iso_decor_rug", w: 300, kind: "flat" },
  decor_lanterns: { key: "iso_decor_lanterns", at: { x: 560, y: 330 }, w: 330, kind: "hanging" },
  decor_painting: { key: "iso_decor_painting", at: { x: 255, y: 395 }, w: 80, kind: "wall" },
  decor_plushies: { key: "iso_decor_plushies", w: 110, kind: "floor" },
  decor_monstera: { key: "iso_decor_monstera", w: 160, kind: "floor" },
  decor_chalkboard: { key: "iso_decor_chalkboard", w: 80, kind: "floor" },
};

/** Bought decor at its default spot: floor and flat items sit on a tile (and can be dragged, see decorProp). */
export const ISO_DECOR = Object.fromEntries(
  (Object.keys(ISO_DECOR_ART) as DecorId[]).map((id) => {
    const a = ISO_DECOR_ART[id];
    const t = DEFAULT_TILES[id];
    return [id, { ...a, at: t ? tileAnchor(id, a.kind, t) : a.at! }];
  }),
) as Record<DecorId, Prop>;

/** Sprite origin for each kind of prop (see Prop.at). */
export const PROP_ORIGIN: Record<Prop["kind"], [number, number]> = {
  floor: [0.5, 1],
  wall: [0.5, 0.5],
  flat: [0.5, 0.5],
  hanging: [0.5, 0],
};

// ---------------------------------------------------------------- arranging decor on floor tiles

/** Items that stand or lie on the floor can be moved; wall and ceiling ones stay put. */
export const isMovable = (id: DecorId) => ISO_DECOR[id].kind === "floor" || ISO_DECOR[id].kind === "flat";

/** The prop for an owned item, at the player's tile when one is saved. */
export function decorProp(id: DecorId, at?: TilePos): Prop {
  const p = ISO_DECOR[id];
  return at && isMovable(id) ? { ...p, at: tileAnchor(id, p.kind, at) } : p;
}

/** Tile an item occupies now (its saved tile, else the one under its default spot). */
export function decorTile(id: DecorId, decorAt: Readonly<Record<string, TilePos>>): TilePos {
  return decorAt[id] ?? DEFAULT_TILES[id] ?? anchorToTile(id, ISO_DECOR[id].at);
}

/** Every tile an item covers when its back tile is `t`. */
export function footprint(id: DecorId, t: TilePos): TilePos[] {
  const n = decorSpan(id);
  const out: TilePos[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ gx: t.gx + dx, gy: t.gy + dy });
  return out;
}

export const canvasToImage = (fit: RoomFit, p: Point): Point => ({ x: (p.x - fit.x) / fit.k, y: (p.y - fit.y) / fit.k });

/** Room area a tile must stay inside: the canvas sides, and clear of the counter and the queue in front of it. */
const SAFE = { side: 4, aboveCounter: 70 };

/** Whole tile visible on this layout's canvas. */
function tileOnScreen(L: Pick<Layout, "room" | "counterY">, fit: RoomFit, t: TilePos): boolean {
  return [
    [t.gx, t.gy],
    [t.gx + 1, t.gy],
    [t.gx, t.gy + 1],
    [t.gx + 1, t.gy + 1],
  ].every(([gx, gy]) => {
    const p = toCanvas(fit, gridToImage(gx, gy));
    return p.x >= SAFE.side && p.x <= L.room.w - SAFE.side && p.y <= L.counterY - SAFE.aboveCounter;
  });
}

/**
 * Back tiles an item may be dropped on for this layout: its whole block on screen (the rug also keeps one tile off the
 * walls). Different screens show different parts of the floor, so a tile chosen on one device may sit partly off
 * screen on another; the item still renders at its saved tile there.
 */
export function placeableTiles(id: DecorId, L: Pick<Layout, "room" | "counterY">): TilePos[] {
  const fit = fitRoom(L);
  const margin = ISO_DECOR[id].kind === "flat" ? 1 : 0;
  const out: TilePos[] = [];
  for (let gy = margin; gy < ROOM_TILES; gy++)
    for (let gx = margin; gx < ROOM_TILES; gx++) if (footprint(id, { gx, gy }).every((t) => tileOnScreen(L, fit, t))) out.push({ gx, gy });
  return out;
}

const FIXED_FLOOR: TilePos[] = [TABLE_TILE];
const same = (a: TilePos, b: TilePos) => a.gx === b.gx && a.gy === b.gy;

/**
 * Can `id` go on tile `t`? Standing items need a tile no other standing item (or furniture) uses; the rug lies under
 * them, so it only has to be on a placeable tile.
 */
export function canPlace(
  id: DecorId,
  t: TilePos,
  owned: readonly string[],
  decorAt: Readonly<Record<string, TilePos>>,
  L: Pick<Layout, "room" | "counterY">,
): boolean {
  if (!isMovable(id)) return false;
  if (same(decorTile(id, decorAt), t)) return true;
  if (!placeableTiles(id, L).some((p) => same(p, t))) return false;
  if (ISO_DECOR[id].kind === "flat") return true;
  if (FIXED_FLOOR.some((p) => same(p, t))) return false;
  return !owned.some((o) => o !== id && isDecorId(o) && ISO_DECOR[o].kind === "floor" && same(decorTile(o, decorAt), t));
}
