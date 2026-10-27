import { describe, expect, it } from "vitest";
import { FLOOR_ORIGIN, fitRoom, imageToTile, isoLayout, ROOM_IMAGE, tileToImage, toCanvas } from "./isoGrid";
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
