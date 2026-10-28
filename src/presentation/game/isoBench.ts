import type { Layout, LayoutKind, StationId, StationSpot } from "./layout";

/**
 * Where things sit on the stepped 2.5D counter. Each layout has its own counter image (`iso_counter_<kind>`, drawn to
 * the size of that layout's worktop) with three tiers; the numbers below are the tiers' front edges measured on the
 * art, in worktop-relative px: the back shelf (tea urns, milk, sugar, ice), the middle surface (cups, cup recess,
 * sealer, trash) and the low front ledge (toppings, shaker). The ticket is a slip pinned to the middle tier's riser.
 */
export interface Bench {
  stations: Record<StationId, StationSpot>;
  ticket: Layout["ticket"];
  cup: Layout["cup"];
}

/** A station standing on a tier: its sprite box is fitted so that its bottom rests at `foot`. */
const on = (
  x: number,
  foot: number,
  w: number,
  h: number,
  labelY?: number,
): StationSpot => ({
  x,
  y: foot - h / 2,
  w,
  h,
  ...(labelY === undefined ? {} : { labelY }),
});

/** The cup view draws its base 100px below `cup.y`, so the recess centre is `cup.y + 100`. */
const cupAt = (x: number, recessY: number) => ({ x, y: recessY - 100 });

/**
 * 720×632 counter at worktop (0, 648): tiers' feet at 862 / 1038 / 1225, recess at (484, 1003). The cup (210px tall)
 * reaches up over the back shelf, so nothing stands behind it there: the syrup pump moves down beside the cups and the
 * bin joins the front ledge.
 */
const PHONE: Bench = {
  stations: {
    tea_black: on(55, 862, 88, 150),
    tea_green: on(160, 862, 88, 150),
    tea_oolong: on(265, 862, 88, 150),
    milk: on(360, 864, 94, 108),
    ice: on(660, 866, 104, 96),
    cup_M: on(62, 1038, 60, 112),
    cup_L: on(150, 1038, 68, 136),
    sugar: on(240, 1038, 56, 130),
    sealer: on(655, 1038, 100, 150),
    top_boba: on(100, 1225, 110, 72, 1232),
    top_jelly: on(270, 1225, 110, 72, 1232),
    top_pudding: on(440, 1225, 110, 72, 1232),
    shaker: on(560, 1225, 50, 92, 1232),
    trash: on(650, 1225, 64, 84, 1232),
  },
  ticket: { x: 12, y: 1078, w: 696, h: 80, titleSize: 20, textSize: 16 },
  cup: cupAt(484, 1003),
};

/** 960×682 counter at worktop (0, 658): tiers' feet at 874 / 1046 / 1231, recess at (480, 1015). */
const TABLET_PORTRAIT: Bench = {
  // The gap in the back row (x ≈ 390–600) keeps the cup and its gauge clear of the stations.
  stations: {
    tea_black: on(90, 874, 100, 165),
    tea_green: on(215, 874, 100, 165),
    tea_oolong: on(340, 874, 100, 165),
    milk: on(660, 876, 112, 124),
    sugar: on(765, 874, 60, 150),
    ice: on(875, 878, 120, 112),
    cup_M: on(90, 1046, 66, 120),
    cup_L: on(195, 1046, 76, 146),
    sealer: on(770, 1046, 110, 165),
    trash: on(885, 1046, 70, 105),
    top_boba: on(200, 1231, 120, 78, 1238),
    top_jelly: on(480, 1231, 120, 78, 1238),
    top_pudding: on(760, 1231, 120, 78, 1238),
    shaker: on(900, 1231, 54, 100, 1238),
  },
  ticket: { x: 16, y: 1084, w: 928, h: 78, titleSize: 20, textSize: 16 },
  cup: cupAt(480, 1015),
};

/** 780×1150 counter at worktop (820, 0): tiers' feet at 258 / 600 / 924, recess at (1210, 549). */
const LANDSCAPE: Bench = {
  stations: {
    tea_black: on(880, 258, 110, 180),
    tea_green: on(990, 258, 110, 180),
    tea_oolong: on(1100, 258, 110, 180),
    milk: on(1230, 260, 130, 140),
    sugar: on(1360, 258, 72, 165),
    ice: on(1500, 262, 130, 125),
    cup_M: on(900, 600, 72, 150),
    cup_L: on(1010, 600, 84, 180),
    sealer: on(1420, 600, 120, 190),
    trash: on(1548, 600, 84, 125),
    top_boba: on(950, 924, 140, 95, 930),
    top_jelly: on(1180, 924, 140, 95, 930),
    top_pudding: on(1410, 924, 140, 95, 930),
    shaker: on(1550, 924, 60, 120, 930),
  },
  ticket: { x: 20, y: 850, w: 780, h: 220, titleSize: 34, textSize: 27 },
  cup: cupAt(1210, 549),
};

export const BENCHES: Record<LayoutKind, Bench> = {
  phone: PHONE,
  tabletPortrait: TABLET_PORTRAIT,
  landscape: LANDSCAPE,
};

/** Counter image drawn over the worktop of each layout. */
export const counterKey = (kind: LayoutKind) =>
  `iso_counter_${kind === "tabletPortrait" ? "tablet" : kind}`;

const shiftY = <T extends { y: number; labelY?: number }>(
  r: T,
  dy: number,
): T => ({
  ...r,
  y: r.y + dy,
  ...(r.labelY === undefined ? {} : { labelY: r.labelY + dy }),
});

/** The bench moved with the worktop (a stretched phone layout pushes everything below the room down by `dy`). */
export function benchFor(
  L: Pick<Layout, "kind" | "worktop">,
  baseWorktopY: number,
): Bench {
  const b = BENCHES[L.kind];
  const dy = L.worktop.y - baseWorktopY;
  if (dy === 0) return b;
  return {
    stations: Object.fromEntries(
      Object.entries(b.stations).map(([k, s]) => [k, shiftY(s, dy)]),
    ) as Bench["stations"],
    ticket: shiftY(b.ticket, dy),
    cup: shiftY(b.cup, dy),
  };
}
