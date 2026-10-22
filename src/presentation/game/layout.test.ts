import { describe, expect, it } from "vitest";
import { LAYOUTS, pickLayoutKind, slotX } from "./layout";

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

describe("layouts", () => {
  for (const L of Object.values(LAYOUTS)) {
    it(`${L.kind}: everything sits inside the stage`, () => {
      for (const [id, s] of Object.entries(L.stations)) {
        expect(s.x - s.w / 2, id).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2, id).toBeLessThanOrEqual(L.width + 20);
        expect(s.y + s.h / 2, id).toBeLessThanOrEqual(L.height);
        // Stations live on the worktop, below/right of the customer room.
        expect(s.x >= L.worktop.x && s.y >= L.worktop.y, id).toBe(true);
      }
      for (const n of [3, 4]) for (let i = 0; i < n; i++) expect(slotX(L, i, n)).toBeLessThan(L.room.w);
      expect(L.cup.x).toBeGreaterThan(L.worktop.x);
      expect(L.ticket.x + L.ticket.w).toBeLessThanOrEqual(L.width);
    });
  }
});
