import type { DecorId } from "@/domain/decor";

/**
 * Where each decor item sits, in bg_room image pixels (603×1080), so it stays glued to the same
 * spot of the room on every layout. Rows ~490–745 stay clear of the HUD and the counter on every layout.
 * `x, y` is the anchor (origin), `w` the displayed width in image px, `depth` a band below the cats.
 */
export interface DecorSpot {
  x: number;
  y: number;
  w: number;
  origin: [number, number];
  depth: number;
}

export const DECOR_SPOTS: Record<DecorId, DecorSpot> = {
  decor_rug: { x: 300, y: 702, w: 190, origin: [0.5, 0.5], depth: 1 },
  decor_lanterns: { x: 318, y: 450, w: 220, origin: [0.5, 0], depth: 2 },
  decor_painting: { x: 165, y: 470, w: 56, origin: [0.5, 0.5], depth: 2 },
  decor_plushies: { x: 70, y: 650, w: 112, origin: [0.5, 1], depth: 3 },
  decor_monstera: { x: 548, y: 735, w: 120, origin: [0.5, 1], depth: 3 },
  decor_chalkboard: { x: 405, y: 690, w: 64, origin: [0.5, 1], depth: 3 },
};

/** Source image size of bg_room, the coordinate space of DECOR_SPOTS. */
export const BG_SIZE = { w: 603, h: 1080 };
