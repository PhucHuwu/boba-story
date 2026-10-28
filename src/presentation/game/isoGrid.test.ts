import { describe, expect, it } from "vitest";
import type { TilePos, WallPos } from "@/domain/types";
import {
  anchorToTile,
  canPlace,
  DEFAULT_POS,
  decorPos,
  decorProp,
  FLOOR_ORIGIN,
  fitRoom,
  footprint,
  gridToImage,
  imageToGrid,
  imageToTile,
  imageToWallCell,
  ISO_DECOR,
  isMovable,
  isoLayout,
  outline,
  placeable,
  ROOM_IMAGE,
  snapPos,
  tileToImage,
  toCanvas,
  wallCellCorners,
  wallCellToImage,
  wallKey,
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
  const owned = ["decor_rug", "decor_monstera", "decor_plushies", "decor_chalkboard", "decor_lanterns", "decor_painting", "decor_clock", "decor_poster"];
  const FLOOR = ["decor_monstera", "decor_plushies", "decor_chalkboard", "decor_rug"] as const;
  const WALL = ["decor_painting", "decor_clock", "decor_poster"] as const;
  const tile = (id: (typeof FLOOR)[number]) => DEFAULT_POS[id] as TilePos;
  const cellOf = (id: (typeof WALL)[number]) => DEFAULT_POS[id] as WallPos;

  it("floor and wall items move; the lantern string stays", () => {
    expect(isMovable("decor_rug")).toBe(true);
    expect(isMovable("decor_monstera")).toBe(true);
    expect(isMovable("decor_painting")).toBe(true);
    expect(isMovable("decor_clock")).toBe(true);
    expect(isMovable("decor_lanterns")).toBe(false);
    expect(decorProp("decor_lanterns", { gx: 1, gy: 1 })).toBe(ISO_DECOR.decor_lanterns);
  });

  const ALL_LAYOUTS = [...Object.values(LAYOUTS), stretchPhone(LAYOUTS.phone, 390, 844)];
  const L = LAYOUTS.landscape;

  it("default spots are distinct and an item can be dropped back on them", () => {
    const spots = [...FLOOR, ...WALL].map((id) => JSON.stringify(decorPos(id, {})));
    expect(new Set(spots).size).toBe(spots.length);
    for (const id of [...FLOOR, ...WALL]) expect(canPlace(id, decorPos(id, {}), owned, {}, L)).toBe(true);
  });

  it("default tiles sit exactly on the grid, placeable on every layout", () => {
    for (const id of FLOOR) {
      const t = tile(id);
      for (const l of ALL_LAYOUTS) expect(placeable(id, l)).toContainEqual(t);
      expect(ISO_DECOR[id].at).toEqual(decorProp(id, t).at);
      expect(anchorToTile(id, ISO_DECOR[id].at)).toEqual(t);
    }
  });

  it("default wall cells are placeable on every layout and use the art skewed for their wall", () => {
    for (const id of WALL) {
      const c = cellOf(id);
      for (const l of ALL_LAYOUTS) expect(placeable(id, l)).toContainEqual(c);
      expect(ISO_DECOR[id].at).toEqual(wallCellToImage(c));
      expect(ISO_DECOR[id].key).toBe(wallKey(`iso_${id}`, c.wall));
      expect(decorProp(id, { wall: "right", s: 0, h: 1 }).key).toBe(`iso_${id}_r`);
      expect(decorProp(id, { wall: "left", s: 3, h: 1 }).key).toBe(`iso_${id}_l`);
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

  it("wall cells stand on the wall planes above the baseboard", () => {
    for (const wall of ["left", "right"] as const) {
      for (const c of [{ wall, s: 1, h: 0 }, { wall, s: 4, h: 1 }]) {
        const [bl, br, tr, tl] = wallCellCorners(c);
        // Vertical edges, bottom edge parallel to the wall foot, lifted off it.
        expect(tl.x).toBe(bl.x);
        expect(tr.x).toBe(br.x);
        const footSlope = wall === "left" ? -0.492 : 0.545;
        expect((br.y - bl.y) / (br.x - bl.x)).toBeCloseTo(footSlope, 2);
        const foot = wall === "left" ? 603.5 - 0.492 * bl.x : 77.1 + 0.545 * bl.x;
        expect(foot - bl.y).toBeGreaterThan(20);
        expect(bl.y - tl.y).toBeGreaterThan(100);
        expect(imageToWallCell(wallCellToImage(c))).toEqual(c);
        expect(outline(c)).toEqual(wallCellCorners(c));
      }
    }
  });

  it("keeps wall items off the window, shelf, door and leaf picture", () => {
    const cells = placeable("decor_painting", L);
    expect(cells.length).toBeGreaterThanOrEqual(6);
    for (const c of cells) expect(c).toHaveProperty("wall");
    const blocked: WallPos[] = [
      { wall: "left", s: 1, h: 1 },
      { wall: "left", s: 0, h: 0 },
      { wall: "left", s: 5, h: 0 },
      { wall: "right", s: 2, h: 0 },
      { wall: "right", s: 3, h: 1 },
      { wall: "right", s: 4, h: 0 },
    ];
    for (const b of blocked) expect(cells).not.toContainEqual(b);
    expect(cells).toContainEqual({ wall: "left", s: 3, h: 1 });
    expect(cells).toContainEqual({ wall: "right", s: 1, h: 0 });
  });

  it("floor items never go on walls and wall items never on the floor", () => {
    expect(canPlace("decor_monstera", { wall: "right", s: 1, h: 0 }, owned, {}, L)).toBe(false);
    expect(canPlace("decor_painting", { gx: 2, gy: 2 }, owned, {}, L)).toBe(false);
    expect(decorPos("decor_painting", { decor_painting: { gx: 2, gy: 2 } })).toEqual(DEFAULT_POS.decor_painting);
    expect(decorProp("decor_monstera", { wall: "left", s: 3, h: 0 })).toBe(ISO_DECOR.decor_monstera);
    expect(snapPos("decor_painting", wallCellToImage({ wall: "right", s: 1, h: 1 }))).toEqual({ wall: "right", s: 1, h: 1 });
    expect(snapPos("decor_monstera", tileToImage(2, 3))).toEqual({ gx: 2, gy: 3 });
  });

  it("stops wall items from sharing a cell", () => {
    const c = cellOf("decor_painting");
    expect(canPlace("decor_clock", c, owned, {}, L)).toBe(false);
    expect(canPlace("decor_painting", c, owned, {}, L)).toBe(true);
    const moved = { decor_painting: { wall: "right", s: 1, h: 0 } as WallPos };
    expect(canPlace("decor_clock", c, owned, moved, L)).toBe(true);
    expect(canPlace("decor_clock", moved.decor_painting, owned, moved, L)).toBe(false);
  });

  it("the rug covers a 2x2 block centred on its footprint", () => {
    expect(footprint("decor_rug", { gx: 2, gy: 2 })).toHaveLength(4);
    expect(footprint("decor_painting", { wall: "left", s: 3, h: 0 })).toHaveLength(1);
    expect(decorProp("decor_rug", { gx: 2, gy: 2 }).at).toEqual(tileToImage(2.5, 2.5));
  });

  it("a saved tile maps back to the same tile", () => {
    for (const id of ["decor_monstera", "decor_rug"] as const) {
      const t = { gx: 2, gy: 1 };
      const p = decorProp(id, t);
      expect(decorPos(id, { [id]: t })).toEqual(t);
      expect(anchorToTile(id, p.at)).toEqual(t);
    }
  });

  it("stops standing items from sharing a tile, the rug may go under them", () => {
    const taken = decorPos("decor_monstera", {});
    expect(canPlace("decor_plushies", taken, owned, {}, L)).toBe(false);
    expect(canPlace("decor_monstera", taken, owned, {}, L)).toBe(true);
    const free = placeable("decor_plushies", L).find((t) => canPlace("decor_plushies", t, owned, {}, L));
    expect(free).toBeDefined();
    const under = placeable("decor_rug", L).find((t) => JSON.stringify(t) === JSON.stringify(taken));
    if (under) expect(canPlace("decor_rug", under, owned, {}, L)).toBe(true);
    expect(canPlace("decor_lanterns", { gx: 1, gy: 1 }, owned, {}, L)).toBe(false);
    expect(canPlace("decor_monstera", { gx: 9, gy: 9 }, owned, {}, L)).toBe(false);
  });

  it("placeable spots cover the visible room of each layout and stay on screen", () => {
    for (const id of ["decor_monstera", "decor_rug", "decor_painting"] as const) {
      for (const l of ALL_LAYOUTS) {
        const spots = placeable(id, l);
        expect(spots.length).toBeGreaterThan(id === "decor_rug" ? 8 : id === "decor_painting" ? 3 : 25);
        const fit = fitRoom(l);
        for (const s of spots) {
          for (const ip of outline(s, "wall" in s ? 0.2 : 0)) {
            const c = toCanvas(fit, ip);
            expect(c.x).toBeGreaterThan(0);
            expect(c.x).toBeLessThan(l.room.w);
            expect(c.y).toBeGreaterThan(90);
            expect(c.y).toBeLessThan(l.counterY - 69);
          }
        }
      }
    }
  });
});
