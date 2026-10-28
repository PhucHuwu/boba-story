import { type DecorId, isDecorId, ROOM_TILES } from "@/domain/decor";
import type { TilePos } from "@/domain/types";
import { LAYOUTS, type Layout, type Point, stretchPhone } from "./layout";

/**
 * 2.5D room geometry. `iso_room` is a square image of an empty room: two back walls meeting at the top centre and a
 * plank floor filling the rest. Positions are kept in that image's pixels (1024²) and mapped to the canvas with
 * `fitRoom`, so props stay glued to the same spot of the room on every layout.
 */
export const ROOM_IMAGE = 1024;
/** Where the two back walls meet the floor. */
export const FLOOR_ORIGIN: Point = { x: 512, y: 358 };
/** Floor tile in image px (true 2:1 isometric). */
export const TILE = { w: 160, h: 80 };
/** Foot of the entrance door on the back-right wall. */
export const DOOR_FOOT: Point = { x: 730, y: 515 };

/** Centre of floor tile (gx, gy) in image px; gx runs along the back-right wall, gy along the back-left wall. */
export function tileToImage(gx: number, gy: number): Point {
  return {
    x: FLOOR_ORIGIN.x + ((gx - gy) * TILE.w) / 2,
    y: FLOOR_ORIGIN.y + ((gx + gy + 1) * TILE.h) / 2,
  };
}

/** Floor tile under an image point (inverse of tileToImage). */
export function imageToTile(p: Point): { gx: number; gy: number } {
  const u = (p.x - FLOOR_ORIGIN.x) / (TILE.w / 2);
  const v = (p.y - FLOOR_ORIGIN.y) / (TILE.h / 2);
  return { gx: Math.floor((u + v) / 2), gy: Math.floor((v - u) / 2) };
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
  const c = { x: p.x, y: p.y - (kind === "flat" ? 0 : FOOT_DY) - half * TILE.h };
  return imageToTile(c);
}

/** Default tiles of the items that stand or lie on the floor (all inside placeableTiles). */
export const DEFAULT_TILES: Partial<Record<DecorId, TilePos>> = {
  decor_rug: { gx: 2, gy: 2 },
  decor_plushies: { gx: 0, gy: 2 },
  decor_monstera: { gx: 5, gy: 1 },
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

/** Clear of the HUD, the screen sides and the queue in front of the counter, on every layout. */
const SAFE = { side: 45, aboveCounter: 100 };
const LAYOUTS_TO_FIT = [...Object.values(LAYOUTS), stretchPhone(LAYOUTS.phone, 720, 1560)];

function onScreenEverywhere(t: TilePos): boolean {
  const c = tileToImage(t.gx, t.gy);
  return LAYOUTS_TO_FIT.every((L) => {
    const p = toCanvas(fitRoom(L), { x: c.x, y: c.y + 20 });
    return p.x > SAFE.side && p.x < L.room.w - SAFE.side && p.y < L.counterY - SAFE.aboveCounter;
  });
}

/** Back tiles an item may be dropped on: its whole block on screen (the rug also keeps one tile off the walls). */
export function placeableTiles(id: DecorId): TilePos[] {
  const margin = ISO_DECOR[id].kind === "flat" ? 1 : 0;
  const out: TilePos[] = [];
  for (let gy = margin; gy < ROOM_TILES; gy++)
    for (let gx = margin; gx < ROOM_TILES; gx++) if (footprint(id, { gx, gy }).every(onScreenEverywhere)) out.push({ gx, gy });
  return out;
}

const FIXED_FLOOR: TilePos[] = [TABLE_TILE];
const same = (a: TilePos, b: TilePos) => a.gx === b.gx && a.gy === b.gy;

/**
 * Can `id` go on tile `t`? Standing items need a tile no other standing item (or furniture) uses; the rug lies under
 * them, so it only has to be on a placeable tile.
 */
export function canPlace(id: DecorId, t: TilePos, owned: readonly string[], decorAt: Readonly<Record<string, TilePos>>): boolean {
  if (!isMovable(id)) return false;
  if (same(decorTile(id, decorAt), t)) return true;
  if (!placeableTiles(id).some((p) => same(p, t))) return false;
  if (ISO_DECOR[id].kind === "flat") return true;
  if (FIXED_FLOOR.some((p) => same(p, t))) return false;
  return !owned.some((o) => o !== id && isDecorId(o) && ISO_DECOR[o].kind === "floor" && same(decorTile(o, decorAt), t));
}
