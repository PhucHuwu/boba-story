import { type DecorId, isDecorId, isWallPos, ROOM_TILES, WALL_CELLS } from "@/domain/decor";
import type { DecorPos, TilePos, WallPos } from "@/domain/types";
import { benchFor } from "./isoBench";
import { type Layout, LAYOUTS, type Point } from "./layout";

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

/**
 * The same layout with cats sized for the room, the door taken from the room art and the stations, cup and ticket
 * placed on the stepped counter (isoBench.ts) instead of the flat worktop rows.
 */
export function isoLayout(L: Layout): Layout {
  return {
    ...L,
    ...benchFor(L, LAYOUTS[L.kind].worktop.y),
    benchRows: undefined,
    catHeight: Math.round(L.catHeight * ISO_CAT_SCALE),
    door: toCanvas(fitRoom(L), DOOR_FOOT),
  };
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
  { key: "iso_shelf", at: { x: 97, y: 400 }, w: 180, kind: "wall" },
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

// ---------------------------------------------------------------- wall cells

/** Wall cell in image px: height of a row, and the gap between the baseboard and the lowest row. */
export const WALL_CELL = { h: 112, lift: 24 };

/** Foot of a wall cell's edge `s` cells from the corner, on the floor line of that wall. */
const wallFoot = (wall: WallPos["wall"], s: number): Point => (wall === "left" ? gridToImage(0, s) : gridToImage(s, 0));

/** Corners of a wall cell in image px: bottom near the corner, bottom far, top far, top near (a parallelogram). */
export function wallCellCorners(c: WallPos, inset = 0): Point[] {
  const a = wallFoot(c.wall, c.s + inset);
  const b = wallFoot(c.wall, c.s + 1 - inset);
  const y0 = WALL_CELL.lift + c.h * WALL_CELL.h + inset * TILE.w;
  const y1 = y0 + WALL_CELL.h - 2 * inset * TILE.w;
  return [
    { x: a.x, y: a.y - y0 },
    { x: b.x, y: b.y - y0 },
    { x: b.x, y: b.y - y1 },
    { x: a.x, y: a.y - y1 },
  ];
}

/** Centre of a wall cell in image px. */
export function wallCellToImage(c: WallPos): Point {
  const [p, q, r] = wallCellCorners(c);
  return { x: (p.x + q.x) / 2, y: (p.y + r.y) / 2 };
}

/** Wall cell under an image point (may be out of range: check with placeable). */
export function imageToWallCell(p: Point): WallPos {
  const wall: WallPos["wall"] = p.x >= FLOOR_ORIGIN.x ? "right" : "left";
  const s = Math.abs(p.x - FLOOR_ORIGIN.x) / (TILE.w / 2);
  const foot = wallFoot(wall, s);
  return { wall, s: Math.floor(s), h: Math.floor((foot.y - p.y - WALL_CELL.lift) / WALL_CELL.h) };
}

/** Texture of a wall item's art skewed to a wall (made by scripts/gen-assets.mjs from the front-view art). */
export const wallKey = (key: string, wall: WallPos["wall"]) => `${key}_${wall[0]}`;

/** Cells covered by what the room art and the fixed shelf already show: window, shelf, door, leaf picture. */
const FIXED_WALL: WallPos[] = (
  [
    ["left", [0, 1, 2]],
    ["left", [4, 5, 6]],
    ["right", [2, 3]],
    ["right", [4, 5]],
  ] as const
).flatMap(([wall, ss]) => ss.flatMap((s) => [0, 1].map((h) => ({ wall, s, h }))));

// ---------------------------------------------------------------- decor art and default spots

/** Default spots of the movable items: floor and flat ones on a tile, wall ones in a wall cell (all placeable). */
export const DEFAULT_POS: Partial<Record<DecorId, DecorPos>> = {
  decor_rug: { gx: 2, gy: 2 },
  decor_plushies: { gx: 0, gy: 2 },
  decor_monstera: { gx: 5, gy: 2 },
  decor_chalkboard: { gx: 1, gy: 0 },
  decor_painting: { wall: "left", s: 3, h: 0 },
  decor_clock: { wall: "right", s: 0, h: 0 },
  decor_poster: { wall: "right", s: 1, h: 0 },
};

const ISO_DECOR_ART: Record<DecorId, Omit<Prop, "at"> & { at?: Point }> = {
  decor_rug: { key: "iso_decor_rug", w: 300, kind: "flat" },
  decor_lanterns: { key: "iso_decor_lanterns", at: { x: 560, y: 330 }, w: 330, kind: "hanging" },
  decor_painting: { key: "iso_decor_painting", w: 66, kind: "wall" },
  decor_plushies: { key: "iso_decor_plushies", w: 110, kind: "floor" },
  decor_monstera: { key: "iso_decor_monstera", w: 160, kind: "floor" },
  decor_chalkboard: { key: "iso_decor_chalkboard", w: 80, kind: "floor" },
  decor_clock: { key: "iso_decor_clock", w: 52, kind: "wall" },
  decor_poster: { key: "iso_decor_poster", w: 62, kind: "wall" },
};

/** Which spots an item can take: wall items hang in wall cells, floor and flat ones stand on tiles. */
const onWall = (id: DecorId) => ISO_DECOR_ART[id].kind === "wall";
const fits = (id: DecorId, pos: DecorPos) => isWallPos(pos) === onWall(id);

/** The prop for an item at a given spot (its art skewed to the wall it hangs on). */
function propAt(id: DecorId, pos: DecorPos): Prop {
  const a = ISO_DECOR_ART[id];
  if (isWallPos(pos)) return { ...a, key: wallKey(a.key, pos.wall), at: wallCellToImage(pos) };
  return { ...a, at: tileAnchor(id, a.kind, pos) };
}

/** Bought decor at its default spot. */
export const ISO_DECOR = Object.fromEntries(
  (Object.keys(ISO_DECOR_ART) as DecorId[]).map((id) => {
    const a = ISO_DECOR_ART[id];
    const pos = DEFAULT_POS[id];
    return [id, pos ? propAt(id, pos) : { ...a, at: a.at! }];
  }),
) as Record<DecorId, Prop>;

/** Sprite origin for each kind of prop (see Prop.at). */
export const PROP_ORIGIN: Record<Prop["kind"], [number, number]> = {
  floor: [0.5, 1],
  wall: [0.5, 0.5],
  flat: [0.5, 0.5],
  hanging: [0.5, 0],
};

// ---------------------------------------------------------------- arranging decor on tiles and wall cells

/** Items on the floor and on the walls can be moved; the lantern string stays put. */
export const isMovable = (id: DecorId) => id in DEFAULT_POS;

/** The prop for an owned item, at the player's spot when a valid one is saved. */
export function decorProp(id: DecorId, at?: DecorPos): Prop {
  return at && isMovable(id) && fits(id, at) ? propAt(id, at) : ISO_DECOR[id];
}

/** Spot an item occupies now (its saved spot if it fits the item, else its default). */
export function decorPos(id: DecorId, decorAt: Readonly<Record<string, DecorPos>>): DecorPos {
  const at = decorAt[id];
  return at && fits(id, at) ? at : (DEFAULT_POS[id] ?? anchorToTile(id, ISO_DECOR[id].at));
}

/** Every tile or cell an item covers when placed at `pos` (the rug covers a block behind its back tile). */
export function footprint(id: DecorId, pos: DecorPos): DecorPos[] {
  if (isWallPos(pos)) return [pos];
  const n = decorSpan(id);
  const out: TilePos[] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push({ gx: pos.gx + dx, gy: pos.gy + dy });
  return out;
}

/** Corners of one tile or wall cell in image px, pulled in by `inset` (fraction of a tile). */
export function outline(pos: DecorPos, inset = 0): Point[] {
  if (isWallPos(pos)) return wallCellCorners(pos, inset);
  return [
    [pos.gx + inset, pos.gy + inset],
    [pos.gx + 1 - inset, pos.gy + inset],
    [pos.gx + 1 - inset, pos.gy + 1 - inset],
    [pos.gx + inset, pos.gy + 1 - inset],
  ].map(([gx, gy]) => gridToImage(gx, gy));
}

/** Spot an item held by its anchor at image point `p` would snap to (may be unplaceable: check with canPlace). */
export function snapPos(id: DecorId, p: Point): DecorPos {
  if (onWall(id)) return imageToWallCell(p);
  const g = imageToGrid(p);
  const half = (decorSpan(id) - 1) / 2;
  return { gx: Math.floor(g.x - half), gy: Math.floor(g.y - half) };
}

export const canvasToImage = (fit: RoomFit, p: Point): Point => ({ x: (p.x - fit.x) / fit.k, y: (p.y - fit.y) / fit.k });

/** Room area a spot must stay inside: the canvas sides, below the HUD, and clear of the counter and the queue. */
const SAFE = { side: 4, top: 96, aboveCounter: 70 };

/** Whole tile, or the middle of a wall cell (where its item hangs), visible on this layout's canvas and the room art. */
function onScreen(L: Pick<Layout, "room" | "counterY">, fit: RoomFit, pos: DecorPos): boolean {
  return outline(pos, isWallPos(pos) ? 0.2 : 0).every((ip) => {
    if (ip.x < 0 || ip.x > ROOM_IMAGE) return false;
    const p = toCanvas(fit, ip);
    return p.x >= SAFE.side && p.x <= L.room.w - SAFE.side && p.y >= SAFE.top && p.y <= L.counterY - SAFE.aboveCounter;
  });
}

const same = (a: DecorPos, b: DecorPos) =>
  isWallPos(a) ? isWallPos(b) && a.wall === b.wall && a.s === b.s && a.h === b.h : !isWallPos(b) && a.gx === b.gx && a.gy === b.gy;

/**
 * Spots an item may be dropped on for this layout: tiles whose whole block is on screen (the rug also keeps one tile
 * off the walls), or wall cells on screen and clear of the window, shelf, door and leaf picture. Different screens
 * show different parts of the room, so a spot chosen on one device may sit partly off screen on another; the item
 * still renders at its saved spot there.
 */
export function placeable(id: DecorId, L: Pick<Layout, "room" | "counterY">): DecorPos[] {
  const fit = fitRoom(L);
  const out: DecorPos[] = [];
  if (onWall(id)) {
    for (const wall of ["left", "right"] as const)
      for (let h = 0; h < WALL_CELLS.rows; h++)
        for (let s = 0; s < WALL_CELLS.along; s++) {
          const c = { wall, s, h };
          if (!FIXED_WALL.some((f) => same(f, c)) && onScreen(L, fit, c)) out.push(c);
        }
    return out;
  }
  const margin = ISO_DECOR[id].kind === "flat" ? 1 : 0;
  for (let gy = margin; gy < ROOM_TILES; gy++)
    for (let gx = margin; gx < ROOM_TILES; gx++) if (footprint(id, { gx, gy }).every((t) => onScreen(L, fit, t))) out.push({ gx, gy });
  return out;
}

const FIXED_FLOOR: TilePos[] = [TABLE_TILE];

/**
 * Can `id` go at `pos`? Standing and hanging items need a spot no other such item (or furniture) uses; the rug lies
 * under them, so it only has to be on a placeable tile.
 */
export function canPlace(
  id: DecorId,
  pos: DecorPos,
  owned: readonly string[],
  decorAt: Readonly<Record<string, DecorPos>>,
  L: Pick<Layout, "room" | "counterY">,
): boolean {
  if (!isMovable(id) || !fits(id, pos)) return false;
  if (same(decorPos(id, decorAt), pos)) return true;
  if (!placeable(id, L).some((p) => same(p, pos))) return false;
  const kind = ISO_DECOR[id].kind;
  if (kind === "flat") return true;
  if (FIXED_FLOOR.some((p) => same(p, pos))) return false;
  return !owned.some((o) => o !== id && isDecorId(o) && ISO_DECOR[o].kind === kind && same(decorPos(o, decorAt), pos));
}
