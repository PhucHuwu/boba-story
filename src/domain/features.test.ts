import { describe, expect, it } from "vitest";
import { defaultSave } from "./catalog";
import { comboTipBonus, goalStatus, planDay } from "./dayPlan";
import { emptyDayStats } from "./ledger";
import { deposit, isBankrupt, isTaxDay, loanOffer, rentFor, repayLoan, resolveNight, robberyChance, takeLoan, TAX_RATE } from "./night";
import { PETTY_COMMENTS, addReview, ratingSpawnFactor, shopRating, starsForQuality, writeReview, REVIEW_KEEP } from "./reviews";
import { RIVAL_EVENTS } from "./rivalEvents";
import { migrate } from "./saveSchema";
import type { Review } from "./types";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("reviews", () => {
  it("maps quality to stars and a lost customer to 1★", () => {
    expect(starsForQuality(null)).toBe(1);
    expect(starsForQuality(95)).toBe(5);
    expect(starsForQuality(75)).toBe(4);
    expect(starsForQuality(30)).toBe(1);
  });

  it("sometimes leaves a petty comment even for a great drink", () => {
    const petty = writeReview({ quality: 95, patience: 80, archetype: "office", rng: seq(0, 0.01) });
    expect(PETTY_COMMENTS).toContain(petty.text);
    expect(petty.stars).toBe(4);
    const fair = writeReview({ quality: 95, patience: 80, archetype: "office", rng: seq(0, 0.9) });
    expect(fair.stars).toBe(5);
  });

  it("applies today's malus (e.g. rubbish) and long waits", () => {
    const r = writeReview({ quality: 95, patience: 80, archetype: "student", rng: seq(0, 0.1), malus: { chance: 0.5, texts: ["Bẩn!"] } });
    expect(r).toEqual({ stars: 4, text: "Bẩn!" });
    expect(writeReview({ quality: 95, patience: 10, archetype: "student", rng: seq(0, 0.9) }).stars).toBe(4);
  });

  it("rates the shop on recent reviews, critics weigh triple, and the rating drives traffic", () => {
    const mk = (stars: number, critic = false): Review => ({ id: 0, day: 1, stars, text: "", archetype: "office", ...(critic ? { critic } : {}) });
    expect(shopRating([])).toBeNull();
    expect(shopRating([mk(5), mk(1)])).toBe(3);
    expect(shopRating([mk(5, true), mk(1)])).toBe(4);
    expect(ratingSpawnFactor(5)).toBeLessThan(1);
    expect(ratingSpawnFactor(1.5)).toBeGreaterThan(1);
    let list: Review[] = [];
    for (let i = 0; i < REVIEW_KEEP + 5; i++) list = addReview(list, { ...mk(5), id: i });
    expect(list).toHaveLength(REVIEW_KEEP);
    expect(list[0].id).toBe(5);
  });
});

describe("day plan", () => {
  it("never sends the rival before day 3 or during the tutorial, and festival every 7th day", () => {
    const save = defaultSave();
    expect(planDay(save, () => 0, 5).rival).toBeNull();
    save.tutorialDone = true;
    save.day = 2;
    expect(planDay(save, () => 0, 5).rival).toBeNull();
    save.day = 5;
    expect(planDay(save, () => 0, 5).rival).not.toBeNull();
    save.day = 7;
    expect(planDay(save, () => 0.99, null).weather).toBe("festival");
  });

  it("checks goals against the day's stats", () => {
    const st = emptyDayStats();
    st.served = 5;
    expect(goalStatus({ kind: "served", target: 5, reward: 10 }, st).met).toBe(true);
    expect(goalStatus({ kind: "noLost", target: 0, reward: 10 }, st).met).toBe(true);
    st.lost = 1;
    expect(goalStatus({ kind: "noLost", target: 0, reward: 10 }, st).met).toBe(false);
    st.reviews = 3;
    st.starsSum = 13;
    expect(goalStatus({ kind: "avgStars", target: 4, reward: 10 }, st).met).toBe(true);
  });

  it("combo raises tips progressively with a cap", () => {
    expect(comboTipBonus(1)).toBe(0);
    expect(comboTipBonus(3)).toBeCloseTo(0.2);
    expect(comboTipBonus(50)).toBe(0.6);
  });
});

describe("rival events", () => {
  it("every option is resolvable and costs what it says", () => {
    for (const ev of Object.values(RIVAL_EVENTS)) {
      expect(ev.options.length).toBeGreaterThanOrEqual(2);
      for (const o of ev.options) for (const r of [0.01, 0.99]) expect(o.resolve(() => r).cost).toBe(o.cost);
    }
  });

  it("throwing the trash back is a gamble", () => {
    const back = RIVAL_EVENTS.trash.options[2];
    expect(back.resolve(() => 0.1).win).toBe(true);
    expect(back.resolve(() => 0.9).reputation).toBeLessThan(0);
  });
});

describe("night: bank, robbery, rent, loan", () => {
  it("robbers never come early, rarely later, less with a camera", () => {
    const save = defaultSave();
    save.money = 1000;
    expect(robberyChance(save, 2)).toBe(0);
    const base = robberyChance(save, 6);
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThan(0.1);
    save.upgrades.push("camera");
    expect(robberyChance(save, 6)).toBeLessThan(base);
  });

  it("a robbery takes all cash in the till but not the bank; the safe keeps most of it", () => {
    const save = defaultSave();
    save.day = 7;
    save.money = 800;
    const r = resolveNight(save, 6, 300, () => 0);
    expect(r.deposited).toBe(300);
    expect(save.bank).toBe(300 - Math.ceil(300 * 0.02) - r.rent + 0);
    expect(r.robbed).toBe(true);
    expect(r.stolen).toBe(500);
    expect(save.money).toBe(0);

    const safe = defaultSave();
    safe.money = 1000;
    safe.upgrades.push("safe");
    const r2 = resolveNight(safe, 6, 0, () => 0);
    expect(r2.stolen).toBe(350);
  });

  it("unpaid bills mean bankruptcy; the bank loan pays them and gives capital", () => {
    const save = defaultSave();
    save.money = 1000;
    resolveNight(save, 6, 0, () => 0);
    expect(save.money).toBe(0);
    expect(save.overdue).toBe(rentFor(7));
    expect(isBankrupt(save)).toBe(true);
    const offer = loanOffer(save);
    takeLoan(save);
    expect(save.overdue).toBe(0);
    expect(save.money).toBe(offer.amount - rentFor(7));
    expect(save.loan?.remaining).toBe(offer.total);
    expect(isBankrupt(save)).toBe(false);
    // Installments are collected each morning; early repayment works too.
    const before = save.loan!.remaining;
    resolveNight(save, 7, 0, () => 0.99);
    expect(save.loan!.remaining).toBe(before - offer.installment);
    save.money = 10_000;
    repayLoan(save, 10_000);
    expect(save.loan).toBeNull();
  });

  it("the police cat taxes a week of takings on the morning after each 7th day", () => {
    expect([2, 7, 8, 9, 15].map(isTaxDay)).toEqual([false, false, true, false, true]);
    const save = defaultSave();
    save.money = 2000;
    save.taxBase = 1234;
    const quiet = resolveNight(save, 5, 0, () => 0.99);
    expect(quiet.tax).toBe(0);
    expect(save.taxBase).toBe(1234);
    const r = resolveNight(save, 7, 0, () => 0.99);
    expect(r.tax).toBe(Math.floor(1234 * TAX_RATE));
    expect(save.taxBase).toBe(0);
    expect(save.money).toBe(2000 - quiet.rent - r.rent - r.tax);
  });

  it("deposit fee is small and never deposits more than the cash", () => {
    const save = defaultSave();
    save.money = 100;
    expect(deposit(save, 500)).toBe(2);
    expect(save.money).toBe(0);
    expect(save.bank).toBe(98);
  });
});

describe("save v2", () => {
  it("migrates a v1 save without losing progress and sanitizes new fields", () => {
    const v1 = { ...defaultSave(), version: 1, money: 777 } as Record<string, unknown>;
    for (const k of ["bank", "loan", "reviews", "nextReviewId", "plan", "lastRobberyDay", "nightPending", "overdue"]) delete v1[k];
    const s = migrate(v1)!;
    expect(s.version).toBe(3);
    expect(s.taxBase).toBe(0);
    expect(s.money).toBe(777);
    expect(s.reviews).toEqual([]);
    expect(s.loan).toBeNull();
    const bad = migrate({ ...defaultSave(), reviews: [{ stars: 99, text: "x", archetype: "office" }, { text: 3 }], loan: { remaining: -5 }, plan: { weather: "lava" } })!;
    expect(bad.reviews).toHaveLength(1);
    expect(bad.reviews[0].stars).toBe(5);
    expect(bad.loan).toBeNull();
    expect(bad.plan).toBeNull();
  });
});

describe("delivery apps", () => {
  it("the app keeps 20% of each cup's price", async () => {
    const { splitCommission, currentOrder, createDelivery } = await import("./delivery");
    expect(splitCommission(40)).toEqual({ net: 32, commission: 8 });
    expect(splitCommission(0)).toEqual({ net: 0, commission: 0 });
    const o = (id: number) => ({ id, recipeId: "classic", size: "M" as const, sugar: 50 as const, ice: 50 as const });
    const d = createDelivery("bee", [o(1), o(2)]);
    expect(currentOrder(d).id).toBe(1);
    d.done = 1;
    expect(currentOrder(d).id).toBe(2);
  });
});

describe("special guests", () => {
  it("each guest comes at most once a day, only from their start day", async () => {
    const { pickGuest } = await import("./guests");
    expect(pickGuest(() => 0, 1, 50, [])).toBe(null);
    expect(pickGuest(() => 0, 2, 50, [])).toBe("granny");
    expect(pickGuest(() => 0, 4, 50, [])).toBe("tiktoker");
    expect(pickGuest(() => 0, 4, 5, [])).toBe("granny");
    expect(pickGuest(() => 0, 4, 50, ["tiktoker", "granny"])).toBe(null);
    expect(pickGuest(() => 0.99, 9, 90, [])).toBe(null);
  });

  it("the TikToker's video goes viral, flops or is ignored", async () => {
    const { tiktokerVerdict, FLOP_REPUTATION, VIRAL } = await import("./guests");
    expect(tiktokerVerdict(90, false)).toMatchObject({ kind: "viral", reputation: VIRAL.reputation });
    expect(tiktokerVerdict(90, true)).toMatchObject({ kind: "flop", reputation: FLOP_REPUTATION });
    expect(tiktokerVerdict(40, false).kind).toBe("flop");
    expect(tiktokerVerdict(65, false).kind).toBe("meh");
  });

  it("the granny's gift never overfills the shelf", async () => {
    const { receiveGift } = await import("./guests");
    const save = defaultSave();
    save.inventory.top_boba = 58;
    expect(receiveGift(save.inventory, "top_boba", 5)).toBe(2);
    expect(save.inventory.top_boba).toBe(60);
    expect(receiveGift(save.inventory, "top_boba", 5)).toBe(0);
  });

  it("granny orders gently, the TikToker orders big", async () => {
    const { createOrder } = await import("./customers");
    const save = defaultSave();
    save.tutorialDone = true;
    save.day = 5;
    for (let i = 0; i < 20; i++) {
      const rng = () => (i * 0.137) % 1;
      const g = createOrder({ rng, save, archetype: "granny", id: i, makeable: save.unlockedRecipes });
      expect(g.size).toBe("M");
      expect([0, 50]).toContain(g.sugar);
      expect([0, 50]).toContain(g.ice);
      expect(createOrder({ rng, save, archetype: "tiktoker", id: i, makeable: save.unlockedRecipes }).size).toBe("L");
    }
  });
});
