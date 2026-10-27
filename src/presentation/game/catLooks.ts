/**
 * Where accessories sit on the everyday customer art. All values are fractions of the sprite height, measured
 * from the base art (variants are ref-edited from it, so they share the pose). x is from the image centre,
 * y from the top edge; the sprite origin is at the feet (0.5, 1).
 */
export interface HeadPose {
  /** Head centre x. */
  cx: number;
  /** Head width at eye level. */
  w: number;
  /** Top of the skull between the ears. */
  crown: number;
}

type Mood = "idle" | "happy" | "sad" | "impatient";

const pose = (cx: number, w: number, crown: number): HeadPose => ({ cx, w, crown });

export const HEAD_POSES: Record<string, Record<Mood, HeadPose>> = {
  student: {
    idle: pose(0.082, 0.364, 0.048),
    happy: pose(0.082, 0.364, 0.047),
    sad: pose(0.089, 0.398, 0.03),
    impatient: pose(0.074, 0.364, 0.047),
  },
  office: {
    idle: pose(0.046, 0.388, 0.048),
    happy: pose(0.046, 0.388, 0.048),
    sad: pose(0.05, 0.414, 0.03),
    impatient: pose(0.044, 0.388, 0.048),
  },
  picky: {
    idle: pose(-0.002, 0.43, 0.025),
    happy: pose(-0.002, 0.43, 0.025),
    sad: pose(-0.002, 0.464, 0.02),
    impatient: pose(-0.002, 0.43, 0.025),
  },
};

/**
 * How each accessory attaches. Only spots above the eyes (on the crown or beside an ear), so nothing ever
 * covers the face (neck items were dropped: the collar sits under the chin and the paws in several poses).
 * Anchor is relative to the head; width is a share of head width; origin is in the accessory art.
 */
export interface AccessoryFit {
  at: "crown" | "side";
  /** Offset from the anchor, in head widths (x) and sprite heights (y). */
  dx: number;
  dy: number;
  width: number;
  origin: [number, number];
  /** Tilt in degrees, mirrored with the sprite. */
  angle?: number;
}

export const ACCESSORY_FIT: Record<string, AccessoryFit> = {
  acc_beanie: { at: "crown", dx: 0, dy: 0.085, width: 0.72, origin: [0.5, 1] },
  acc_cap: { at: "crown", dx: 0, dy: 0.085, width: 0.74, origin: [0.5, 1] },
  acc_wreath: { at: "crown", dx: 0, dy: 0.075, width: 0.74, origin: [0.5, 1] },
  acc_bow: { at: "side", dx: 0.3, dy: 0.02, width: 0.4, origin: [0.5, 0.5], angle: 15 },
  acc_flower: { at: "side", dx: 0.3, dy: 0.03, width: 0.34, origin: [0.5, 0.5], angle: 15 },
  acc_star: { at: "side", dx: -0.3, dy: 0.03, width: 0.3, origin: [0.5, 0.5], angle: -12 },
};

/** Accessory placement in sprite-local pixels (relative to the feet origin, before the sprite's own scale/angle). */
export function accessoryPlacement(arch: string, mood: string, acc: string, texHeight: number) {
  const p = HEAD_POSES[arch]?.[mood as Mood] ?? HEAD_POSES[arch]?.idle;
  const fit = ACCESSORY_FIT[acc];
  if (!p || !fit) return null;
  return {
    x: (p.cx + fit.dx * p.w) * texHeight,
    y: (p.crown + fit.dy - 1) * texHeight,
    width: fit.width * p.w * texHeight,
    origin: fit.origin,
    angle: fit.angle ?? 0,
  };
}
