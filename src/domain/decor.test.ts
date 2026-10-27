import { describe, expect, it } from "vitest";
import { QUESTS, defaultSave } from "./catalog";
import { createCustomer } from "./customers";
import { DECOR, buyDecor, decorBonus, decorUnlocked } from "./decor";
import { refreshQuests } from "./economy";
import { migrate } from "./saveSchema";

describe("decor", () => {
  it("buys an item once, spending money", () => {
    const save = defaultSave();
    save.money = 500;
    expect(buyDecor(save, "decor_rug")).toEqual({ ok: true });
    expect(save.money).toBe(380);
    expect(save.decor).toEqual(["decor_rug"]);
    expect(buyDecor(save, "decor_rug").ok).toBe(false);
    expect(buyDecor(save, "decor_gold").ok).toBe(false);
  });

  it("respects money and unlock conditions", () => {
    const save = defaultSave();
    save.money = 1000;
    expect(buyDecor(save, "decor_chalkboard")).toEqual({ ok: false, reason: "Cần 40 danh tiếng" });
    expect(buyDecor(save, "decor_painting").ok).toBe(false);
    save.regularStage = 3;
    save.reputation = 40;
    expect(DECOR.every((d) => decorUnlocked(save, d))).toBe(true);
    expect(buyDecor(save, "decor_painting").ok).toBe(true);
    save.money = 10;
    expect(buyDecor(save, "decor_monstera")).toEqual({ ok: false, reason: "Không đủ xu" });
  });

  it("sums effects and slows patience decay", () => {
    expect(decorBonus(["decor_lanterns", "decor_chalkboard", "decor_rug"], "tip")).toBeCloseTo(0.09);
    const order = { id: 1, recipeId: "classic_boba", size: "M" as const, sugar: 50 as const, ice: 50 as const };
    const plain = createCustomer(1, "student", order, 0, [], "");
    const cozy = createCustomer(1, "student", order, 0, [], "", ["decor_rug", "decor_monstera"]);
    expect(cozy.decay).toBeCloseTo(plain.decay / 1.1);
  });

  it("migrates: old saves get an empty list, unknown items are dropped", () => {
    expect(migrate({ version: 3 })?.decor).toEqual([]);
    expect(migrate({ version: 4, decor: ["decor_rug", "decor_rug", "hack", 5] })?.decor).toEqual(["decor_rug"]);
  });

  it("counts toward the decorating quest", () => {
    const save = defaultSave();
    save.decor = ["decor_rug", "decor_monstera", "decor_lanterns"];
    refreshQuests(save);
    expect(QUESTS.some((q) => q.metric === "decor")).toBe(true);
    expect(save.quests.q_decor3.done).toBe(true);
  });
});
