import { describe, expect, it } from "vitest";
import {
  canPlace,
  decorProp,
  decorTile,
  FLOOR_ORIGIN,
  fitRoom,
  imageToTile,
  ISO_DECOR,
  isMovable,
  isoLayout,
  placeableTiles,
  ROOM_IMAGE,
  tileToImage,
  toCanvas,
} from "./isoGrid";
import { LAYOUTS, stretchPhone } from "./layout";

describe("isoGrid", () => {
  it("round-trips tile centres", () => {
    for (const [gx, gy] of [[0, 0], [3, 1], [0, 4], [5, 5]]) expect(imageToTile(tileToImage(gx, gy))).toEqual({ gx, gy });
  });

  it("puts tile (0,0) just below the wall corner", () => {
    const p = tileToImage(0, 0);
    expect(p.x).toBe(FLOOR_ORIGIN.x);
    expect(p.y).toBeGreaterThan(FLOOR_ORIGIN.y);
  });

  it.each(Object.values(LAYOUTS))("covers the whole room area on $kind", (L) => {
    const fit = fitRoom(L);
    expect(fit.x).toBeLessThanOrEqual(0);
    expect(fit.x + fit.size).toBeGreaterThanOrEqual(L.room.w);
    expect(fit.y).toBeLessThanOrEqual(0);
    expect(fit.y + fit.size).toBeGreaterThanOrEqual(L.counterY);
    expect(fit.k).toBeCloseTo(fit.size / ROOM_IMAGE);
  });

  it.each(Object.values(LAYOUTS))("keeps the door and smaller cats inside the room on $kind", (L) => {
    const iso = isoLayout(L);
    expect(iso.catHeight).toBeLessThan(L.catHeight);
    expect(iso.door.x).toBeGreaterThan(0);
    expect(iso.door.x).toBeLessThan(L.room.w);
    expect(iso.door.y).toBeLessThan(L.counterY);
    const corner = toCanvas(fitRoom(L), FLOOR_ORIGIN);
    expect(corner.y).toBeGreaterThan(0);
  });
});

describe("stretchPhone", () => {
  it("grows the phone room for tall screens and moves the counter with it", () => {
    const L = stretchPhone(LAYOUTS.phone, 390, 844);
    expect(L.height).toBeGreaterThan(LAYOUTS.phone.height);
    const extra = L.height - LAYOUTS.phone.height;
    expect(L.counterY).toBe(LAYOUTS.phone.counterY + extra);
    expect(L.stations.top_boba.labelY).toBe((LAYOUTS.phone.stations.top_boba.labelY ?? 0) + extra);
    expect(L.cup.y).toBe(LAYOUTS.phone.cup.y + extra);
    const fit = fitRoom(L);
    expect(fit.x + fit.size).toBeGreaterThanOrEqual(L.room.w);
  });

  it("leaves 9:16 phones and tablets alone", () => {
    expect(stretchPhone(LAYOUTS.phone, 720, 1280)).toBe(LAYOUTS.phone);
    expect(stretchPhone(LAYOUTS.tabletPortrait, 390, 844)).toBe(LAYOUTS.tabletPortrait);
  });
});

describe("arranging decor", () => {
  const owned = ["decor_rug", "decor_monstera", "decor_plushies", "decor_chalkboard", "decor_lanterns", "decor_painting"];

  it("only floor items move; wall and hanging ones stay", () => {
    expect(isMovable("decor_rug")).toBe(true);
    expect(isMovable("decor_monstera")).toBe(true);
    expect(isMovable("decor_lanterns")).toBe(false);
    expect(isMovable("decor_painting")).toBe(false);
    expect(decorProp("decor_lanterns", { gx: 1, gy: 1 })).toBe(ISO_DECOR.decor_lanterns);
  });

  it("default spots are distinct tiles an item can be dropped back on", () => {
    const tiles = (["decor_monstera", "decor_plushies", "decor_chalkboard"] as const).map((id) => decorTile(id, {}));
    expect(new Set(tiles.map((t) => `${t.gx},${t.gy}`)).size).toBe(3);
    for (const id of ["decor_monstera", "decor_plushies", "decor_chalkboard", "decor_rug"] as const)
      expect(canPlace(id, decorTile(id, {}), owned, {})).toBe(true);
  });

  it("a saved tile maps back to the same tile", () => {
    for (const id of ["decor_monstera", "decor_rug"] as const) {
      const t = { gx: 2, gy: 1 };
      const p = decorProp(id, t);
      expect(decorTile(id, { [id]: t })).toEqual(t);
      expect(imageToTile({ x: p.at.x, y: p.kind === "flat" ? p.at.y : p.at.y - 24 })).toEqual(t);
    }
  });

  it("stops standing items from sharing a tile, the rug may go under them", () => {
    const taken = decorTile("decor_monstera", {});
    expect(canPlace("decor_plushies", taken, owned, {})).toBe(false);
    expect(canPlace("decor_monstera", taken, owned, {})).toBe(true);
    const free = placeableTiles("decor_plushies").find((t) => canPlace("decor_plushies", t, owned, {}));
    expect(free).toBeDefined();
    const under = placeableTiles("decor_rug").find((t) => t.gx === taken.gx && t.gy === taken.gy);
    if (under) expect(canPlace("decor_rug", under, owned, {})).toBe(true);
    expect(canPlace("decor_lanterns", { gx: 1, gy: 1 }, owned, {})).toBe(false);
    expect(canPlace("decor_monstera", { gx: 9, gy: 9 }, owned, {})).toBe(false);
  });

  it("every placeable tile is on screen on every layout", () => {
    for (const id of ["decor_monstera", "decor_rug"] as const) {
      const tiles = placeableTiles(id);
      expect(tiles.length).toBeGreaterThan(8);
      for (const L of [...Object.values(LAYOUTS), stretchPhone(LAYOUTS.phone, 390, 844)]) {
        const fit = fitRoom(L);
        for (const t of tiles) {
          const c = toCanvas(fit, tileToImage(t.gx, t.gy));
          expect(c.x).toBeGreaterThan(0);
          expect(c.x).toBeLessThan(L.room.w);
          expect(c.y).toBeLessThan(L.counterY);
        }
      }
    }
  });
});
