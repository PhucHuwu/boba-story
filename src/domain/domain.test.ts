import { describe, expect, it } from "vitest";
import { addIce, addSugar, addTopping, newCup, pour, seal, shake } from "./cup";
import { createCustomer, tickPatience, transition } from "./customers";
import { INGREDIENTS, QUESTS, RECIPES, defaultSave } from "./catalog";
import { rentFor } from "./night";
import { buyIngredient, buyUpgrade, canMake, claimQuest, needsRecovery, payment, refreshQuests } from "./economy";
import { SKIPPED_SHAKE, evaluate } from "./quality";
import { migrate } from "./saveSchema";
import type { IngredientId, Order, SaveData } from "./types";

function consumer(save: SaveData) {
  const used: IngredientId[] = [];
  const consume = (id: IngredientId) => {
    if (save.inventory[id] <= 0) return false;
    save.inventory[id]--;
    used.push(id);
    return true;
  };
  return { consume, used };
}

const bobaOrder: Order = { id: 1, recipeId: "boba", size: "M", sugar: 50, ice: 50 };

function makePerfectBoba(save: SaveData) {
  const { consume, used } = consumer(save);
  save.inventory.cup--;
  const cup = newCup("M");
  for (let i = 0; i < 12; i++) pour(cup, "tea_black", 0.05, consume);
  for (let i = 0; i < 8; i++) pour(cup, "milk", 0.05, consume);
  addSugar(cup, consume);
  addIce(cup, consume);
  addTopping(cup, "top_boba", consume);
  seal(cup, consume);
  return { cup, used };
}

describe("brewing + inventory", () => {
  it("charges each liquid exactly once per cup no matter how many pour ticks", () => {
    const save = defaultSave();
    const before = { ...save.inventory };
    const { used } = makePerfectBoba(save);
    expect(used.filter((u) => u === "tea_black")).toHaveLength(1);
    expect(used.filter((u) => u === "milk")).toHaveLength(1);
    expect(save.inventory.tea_black).toBe(before.tea_black - 1);
    expect(save.inventory.milk).toBe(before.milk - 1);
    expect(save.inventory.cup).toBe(before.cup - 1);
    expect(save.inventory.lid).toBe(before.lid - 1);
    expect(save.inventory.top_boba).toBe(before.top_boba - 1);
  });

  it("refuses actions on a sealed cup and when out of stock", () => {
    const save = defaultSave();
    const { cup } = makePerfectBoba(save);
    const { consume } = consumer(save);
    expect(addSugar(cup, consume)).toEqual({ ok: false, reason: "sealed" });
    save.inventory.top_jelly = 0;
    expect(addTopping(newCup("M"), "top_jelly", consume)).toEqual({ ok: false, reason: "empty_stock" });
  });
});

describe("quality", () => {
  it("rates a correct drink higher than a wrong one", () => {
    const save = defaultSave();
    const good = evaluate({ cup: makePerfectBoba(save).cup, order: bobaOrder, patience: 90 });
    expect(good.quality).toBeGreaterThanOrEqual(90);
    expect(good.wrongDrink).toBe(false);

    const { consume } = consumer(save);
    const wrong = newCup("M");
    for (let i = 0; i < 20; i++) pour(wrong, "tea_green", 0.05, consume);
    seal(wrong, consume);
    const bad = evaluate({ cup: wrong, order: bobaOrder, patience: 100 });
    expect(bad.wrongDrink).toBe(true);
    expect(bad.quality).toBeLessThanOrEqual(35);
  });

  it("speed alone can not rescue an inaccurate drink", () => {
    const save = defaultSave();
    const { consume } = consumer(save);
    const cup = newCup("M");
    for (let i = 0; i < 6; i++) pour(cup, "tea_black", 0.05, consume);
    addTopping(cup, "top_boba", consume);
    seal(cup, consume);
    const fast = evaluate({ cup, order: bobaOrder, patience: 100 });
    const slowPerfect = evaluate({ cup: makePerfectBoba(defaultSave()).cup, order: bobaOrder, patience: 20 });
    expect(slowPerfect.quality).toBeGreaterThan(fast.quality);
  });

  it("penalizes unsealed and overflowing cups", () => {
    const save = defaultSave();
    const { consume } = consumer(save);
    const cup = newCup("M");
    for (let i = 0; i < 30; i++) pour(cup, "tea_black", 0.05, consume);
    const r = evaluate({ cup, order: { ...bobaOrder, recipeId: "classic" }, patience: 100 });
    expect(r.process).toBe(0);
  });
});

describe("shake step", () => {
  const jasmineOrder: Order = { id: 2, recipeId: "jasmine", size: "M", sugar: 0, ice: 0 };
  const brewJasmine = (shaken: boolean) => {
    const { consume } = consumer(defaultSave());
    const cup = newCup("M");
    for (let i = 0; i < 20; i++) pour(cup, "tea_green", 0.05, consume);
    if (shaken) expect(shake(cup).ok).toBe(true);
    seal(cup, consume);
    return cup;
  };

  it("only the no-milk teas ask for shaking", () => {
    expect(RECIPES.filter((r) => r.shake).map((r) => r.id).sort()).toEqual(["black_jelly", "jasmine"]);
  });

  it("skipping the shake costs process points; shaking a recipe that does not need it is free", () => {
    const skipped = evaluate({ cup: brewJasmine(false), order: jasmineOrder, patience: 100 });
    const shaken = evaluate({ cup: brewJasmine(true), order: jasmineOrder, patience: 100 });
    expect(shaken.process).toBe(100);
    expect(skipped.process).toBe(100 - SKIPPED_SHAKE);
    expect(skipped.notes).toContain("Chưa lắc đều");
    expect(shaken.quality).toBeGreaterThan(skipped.quality);
    const save = defaultSave();
    const { cup } = makePerfectBoba(save);
    expect(evaluate({ cup, order: bobaOrder, patience: 100 }).process).toBe(100);
  });

  it("can shake once, and never after sealing", () => {
    const cup = brewJasmine(false);
    expect(shake(cup)).toEqual({ ok: false, reason: "sealed" });
    const open = newCup("L");
    expect(shake(open).ok).toBe(true);
    expect(shake(open)).toEqual({ ok: false, reason: "limit" });
  });
});

describe("customers", () => {
  it("follows the lifecycle and rejects invalid transitions", () => {
    const c = createCustomer(1, "student", bobaOrder, 0, [], "hi");
    expect(transition(c, "receiving")).toBe(false);
    expect(transition(c, "ordering")).toBe(true);
    expect(transition(c, "waiting")).toBe(true);
    expect(transition(c, "receiving")).toBe(true);
    expect(transition(c, "waiting")).toBe(false);
    expect(transition(c, "leaving")).toBe(true);
    expect(transition(c, "gone")).toBe(true);
  });

  it("loses patience over time and reports when it runs out", () => {
    const c = createCustomer(1, "office", bobaOrder, 0, [], "hi");
    c.state = "waiting";
    let ranOut = false;
    for (let t = 0; t < 120 && !ranOut; t++) ranOut = tickPatience(c, 1, false);
    expect(ranOut).toBe(true);
    expect(c.patience).toBe(0);
  });

  it("never runs out in relaxed mode", () => {
    const c = createCustomer(1, "office", bobaOrder, 0, [], "hi");
    c.state = "waiting";
    for (let t = 0; t < 600; t++) expect(tickPatience(c, 1, true)).toBe(false);
  });
});

describe("economy", () => {
  it("does not let money go negative", () => {
    const save = defaultSave();
    save.money = 5;
    expect(buyIngredient(save, "milk").ok).toBe(false);
    expect(buyUpgrade(save, "fast_tap").ok).toBe(false);
    expect(save.money).toBe(5);
  });

  it("pays nothing for a wrong drink and tips for great ones", () => {
    const save = defaultSave();
    const great = evaluate({ cup: makePerfectBoba(save).cup, order: bobaOrder, patience: 100 });
    const p = payment(bobaOrder, great, "office", []);
    expect(p.price).toBe(32);
    expect(p.tip).toBeGreaterThan(0);
    const wrong = payment(bobaOrder, { ...great, wrongDrink: true, quality: 30 }, "office", []);
    expect(wrong.price + wrong.tip).toBe(0);
  });

  it("can afford the first upgrade after ~2 decent days", () => {
    // 2 days * ~14 customers * ~(32 price - 20 cost) on top of the starting coins, minus day-2 rent.
    const save = defaultSave();
    const perCup = payment(bobaOrder, { quality: 85, recipeAccuracy: 85, orderMatch: 85, process: 100, speed: 70, wrongDrink: false, notes: [] }, "student", []);
    const cost = (["cup", "lid", "tea_black", "milk", "sugar", "ice", "top_boba"] as const).reduce((a, id) => a + INGREDIENTS[id].unitCost, 0);
    const profit = 2 * 14 * (perCup.price + perCup.tip - cost) - rentFor(2);
    expect(save.money + profit).toBeGreaterThan(300 + 200);
  });

  it("detects a soft-lock and the basic recipe stays cheap", () => {
    const save = defaultSave();
    expect(needsRecovery(save)).toBe(false);
    save.money = 0;
    save.inventory.cup = 0;
    expect(needsRecovery(save)).toBe(true);
    expect(RECIPES.some((r) => r.unlockCost === 0 && r.price >= 20)).toBe(true);
    expect(canMake(defaultSave(), "classic")).toBe(true);
  });

  it("completes and pays quests once", () => {
    const save = defaultSave();
    save.stats.served = 3;
    expect(refreshQuests(save)).toContain("q_serve3");
    const money = save.money;
    const reward = QUESTS.find((q) => q.id === "q_serve3")!.reward;
    expect(claimQuest(save, "q_serve3")).toBe(reward);
    expect(claimQuest(save, "q_serve3")).toBe(0);
    expect(save.money).toBe(money + reward);
  });
});

describe("save migration", () => {
  it("round-trips a valid save", () => {
    const save = defaultSave();
    save.money = 1234;
    save.upgrades.push("bell");
    const loaded = migrate(JSON.parse(JSON.stringify(save)));
    expect(loaded?.money).toBe(1234);
    expect(loaded?.upgrades).toEqual(["bell"]);
  });

  it("rejects garbage and sanitizes bad fields", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate("x")).toBeNull();
    expect(migrate({ version: 99 })).toBeNull();
    const fixed = migrate({ version: 1, money: -50, inventory: { milk: "lots" }, unlockedRecipes: ["nope"], upgrades: ["hack"] });
    expect(fixed?.money).toBe(0);
    expect(fixed?.inventory.milk).toBe(defaultSave().inventory.milk);
    expect(fixed?.unlockedRecipes).toEqual(defaultSave().unlockedRecipes);
    expect(fixed?.upgrades).toEqual([]);
  });
});
