import { describe, expect, it } from "vitest";
import { isoLayout } from "./isoGrid";
import {
  LAYOUTS,
  pickLayoutKind,
  slotX,
  type StationSpot,
  stretchPhone,
} from "./layout";

describe("pickLayoutKind", () => {
  it.each([
    [390, 844, "phone"],
    [430, 932, "phone"],
    [820, 1180, "tabletPortrait"],
    [1024, 1366, "tabletPortrait"],
    [1180, 820, "landscape"],
    [1366, 1024, "landscape"],
    [1920, 1080, "landscape"],
  ])("%ix%i → %s", (w, h, kind) => {
    expect(pickLayoutKind(w, h)).toBe(kind);
  });
});

/** Sprite boxes are fitted "inside", so a few px of box overlap never shows. */
const overlap = (a: StationSpot, b: StationSpot) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 12 &&
  Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 12;

describe("layouts", () => {
  const all = [
    ...Object.values(LAYOUTS),
    ...Object.values(LAYOUTS).map(isoLayout),
  ];
  for (const L of all) {
    it(`${L.kind}: stations never overlap each other`, () => {
      const spots = Object.entries(L.stations);
      for (const [id, s] of spots)
        for (const [id2, s2] of spots)
          if (id < id2) expect(overlap(s, s2), `${id} / ${id2}`).toBe(false);
    });
  }
  it("the 2.5D bench moves with a stretched phone layout", () => {
    const base = isoLayout(LAYOUTS.phone);
    const tall = isoLayout(stretchPhone(LAYOUTS.phone, 390, 844));
    const dy = tall.worktop.y - base.worktop.y;
    expect(dy).toBeGreaterThan(0);
    expect(tall.stations.tea_black.y - base.stations.tea_black.y).toBe(dy);
    expect(tall.cup.y - base.cup.y).toBe(dy);
    expect(tall.ticket.y - base.ticket.y).toBe(dy);
    expect(tall.benchRows).toBeUndefined();
  });
  for (const L of all) {
    it(`${L.kind}: everything sits inside the stage`, () => {
      for (const [id, s] of Object.entries(L.stations)) {
        expect(s.x - s.w / 2, id).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2, id).toBeLessThanOrEqual(L.width + 20);
        expect(s.y + s.h / 2, id).toBeLessThanOrEqual(L.height);
        // Stations live on the worktop, below/right of the customer room.
        expect(s.x >= L.worktop.x && s.y >= L.worktop.y, id).toBe(true);
      }
      for (const n of [3, 4])
        for (let i = 0; i < n; i++)
          expect(slotX(L, i, n)).toBeLessThan(L.room.w);
      expect(L.cup.x).toBeGreaterThan(L.worktop.x);
      expect(L.ticket.x + L.ticket.w).toBeLessThanOrEqual(L.width);
    });
  }
});
