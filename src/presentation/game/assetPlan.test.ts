import { describe, expect, it } from "vitest";
import manifest from "./assetManifest.json";
import { planAssets } from "./assetPlan";

const keys = Object.keys(manifest);

describe("planAssets", () => {
  const plan = planAssets(keys, ["decor_rug"]);

  it("covers every game asset exactly once and skips landing art", () => {
    const all = [...plan.critical, ...plan.deferred];
    expect(new Set(all).size).toBe(all.length);
    expect(all.some((k) => k.startsWith("landing_"))).toBe(false);
    expect(all.length).toBe(keys.filter((k) => !k.startsWith("landing_") && k !== "app_icon").length);
  });

  it("loads the room, stations, base cats and drinks up front", () => {
    for (const k of ["bg_room", "ui_card", "pour_stream", "cat_student_idle", "cat_regular_sad", "drink_classic", "icon_combo", "npc_stray_happy", "trash_can"])
      expect(plan.critical).toContain(k);
  });

  it("defers looks, blinks, guests and unowned decor, owned decor stays critical", () => {
    for (const k of ["cat_office_v1_idle", "cat_regular_blink", "cat_granny_blink", "acc_bow", "shipper_bee_idle", "cat_tiktoker_sad", "decor_lanterns", "rival_dog", "npc_police"])
      expect(plan.deferred).toContain(k);
    expect(plan.critical).toContain("decor_rug");
  });

  it("streams guests that can appear early before the cosmetic art", () => {
    const at = (k: string) => plan.deferred.indexOf(k);
    expect(at("shipper_grab_idle")).toBeLessThan(at("cat_student_v1_idle"));
    expect(at("cat_granny_idle")).toBeLessThan(at("cat_regular_blink"));
  });
});
