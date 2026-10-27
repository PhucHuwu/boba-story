import type { DecorId } from "@/domain/decor";
import type { Layout, Point } from "./layout";

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

/** Furniture every shop has. */
export const ROOM_PROPS: Prop[] = [
  { key: "iso_shelf", at: { x: 110, y: 400 }, w: 190, kind: "wall" },
  { key: "iso_table", at: { x: 300, y: 760 }, w: 250, kind: "floor" },
];

/** Bought decor, at fixed spots for now (drag-to-place comes with the next stage). */
export const ISO_DECOR: Record<DecorId, Prop> = {
  decor_rug: { key: "iso_decor_rug", at: { x: 620, y: 690 }, w: 300, kind: "flat" },
  decor_lanterns: { key: "iso_decor_lanterns", at: { x: 560, y: 330 }, w: 330, kind: "hanging" },
  decor_painting: { key: "iso_decor_painting", at: { x: 255, y: 395 }, w: 80, kind: "wall" },
  decor_plushies: { key: "iso_decor_plushies", at: { x: 400, y: 545 }, w: 110, kind: "floor" },
  decor_monstera: { key: "iso_decor_monstera", at: { x: 905, y: 670 }, w: 160, kind: "floor" },
  decor_chalkboard: { key: "iso_decor_chalkboard", at: { x: 600, y: 490 }, w: 80, kind: "floor" },
};

/** Sprite origin for each kind of prop (see Prop.at). */
export const PROP_ORIGIN: Record<Prop["kind"], [number, number]> = {
  floor: [0.5, 1],
  wall: [0.5, 0.5],
  flat: [0.5, 0.5],
  hanging: [0.5, 0],
};
