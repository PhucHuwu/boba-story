import { describe, expect, it } from "vitest";
import {
  anchorToTile,
  canPlace,
  DEFAULT_TILES,
  footprint,
  gridToImage,
  imageToGrid,
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

  const ALL_LAYOUTS = [...Object.values(LAYOUTS), stretchPhone(LAYOUTS.phone, 390, 844)];
  const L = LAYOUTS.landscape;

  it("default spots are distinct tiles an item can be dropped back on", () => {
    const tiles = (["decor_monstera", "decor_plushies", "decor_chalkboard"] as const).map((id) => decorTile(id, {}));
    expect(new Set(tiles.map((t) => `${t.gx},${t.gy}`)).size).toBe(3);
    for (const id of ["decor_monstera", "decor_plushies", "decor_chalkboard", "decor_rug"] as const)
      expect(canPlace(id, decorTile(id, {}), owned, {}, L)).toBe(true);
  });

  it("default spots sit exactly on the grid, placeable on every layout", () => {
    for (const id of ["decor_monstera", "decor_plushies", "decor_chalkboard", "decor_rug"] as const) {
      const t = DEFAULT_TILES[id]!;
      for (const l of ALL_LAYOUTS) expect(placeableTiles(id, l)).toContainEqual(t);
      expect(ISO_DECOR[id].at).toEqual(decorProp(id, t).at);
      expect(anchorToTile(id, ISO_DECOR[id].at)).toEqual(t);
    }
  });

  it("the grid follows the back walls of the art", () => {
    // Floor edge measured on iso_room: left wall y = 603.5 - 0.492x, right wall y = 77.1 + 0.545x.
    const l = gridToImage(0, 4);
    expect(Math.abs(l.y - (603.5 - 0.492 * l.x))).toBeLessThan(2);
    const r = gridToImage(4, 0);
    expect(Math.abs(r.y - (77.1 + 0.545 * r.x))).toBeLessThan(2);
    const g = imageToGrid(gridToImage(2.25, 3.5));
    expect(g.x).toBeCloseTo(2.25);
    expect(g.y).toBeCloseTo(3.5);
  });

  it("the rug covers a 2x2 block centred on its footprint", () => {
    expect(footprint("decor_rug", { gx: 2, gy: 2 })).toHaveLength(4);
    expect(decorProp("decor_rug", { gx: 2, gy: 2 }).at).toEqual(tileToImage(2.5, 2.5));
  });

  it("a saved tile maps back to the same tile", () => {
    for (const id of ["decor_monstera", "decor_rug"] as const) {
      const t = { gx: 2, gy: 1 };
      const p = decorProp(id, t);
      expect(decorTile(id, { [id]: t })).toEqual(t);
      expect(anchorToTile(id, p.at)).toEqual(t);
    }
  });

  it("stops standing items from sharing a tile, the rug may go under them", () => {
    const taken = decorTile("decor_monstera", {});
    expect(canPlace("decor_plushies", taken, owned, {}, L)).toBe(false);
    expect(canPlace("decor_monstera", taken, owned, {}, L)).toBe(true);
    const free = placeableTiles("decor_plushies", L).find((t) => canPlace("decor_plushies", t, owned, {}, L));
    expect(free).toBeDefined();
    const under = placeableTiles("decor_rug", L).find((t) => t.gx === taken.gx && t.gy === taken.gy);
    if (under) expect(canPlace("decor_rug", under, owned, {}, L)).toBe(true);
    expect(canPlace("decor_lanterns", { gx: 1, gy: 1 }, owned, {}, L)).toBe(false);
    expect(canPlace("decor_monstera", { gx: 9, gy: 9 }, owned, {}, L)).toBe(false);
  });

  it("placeable tiles cover the visible floor of each layout and stay on screen", () => {
    for (const id of ["decor_monstera", "decor_rug"] as const) {
      for (const l of ALL_LAYOUTS) {
        const tiles = placeableTiles(id, l);
        expect(tiles.length).toBeGreaterThan(id === "decor_rug" ? 8 : 25);
        const fit = fitRoom(l);
        for (const t of tiles) {
          const c = toCanvas(fit, tileToImage(t.gx, t.gy));
          expect(c.x).toBeGreaterThan(0);
          expect(c.x).toBeLessThan(l.room.w);
          expect(c.y).toBeLessThan(l.counterY - 70);
        }
      }
    }
  });
});
