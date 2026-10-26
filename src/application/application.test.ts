import { describe, expect, it, vi } from "vitest";
import { defaultSave } from "@/domain/catalog";
import type { SaveData } from "@/domain/types";
import { CloudSaveService } from "./cloud/cloudSaveService";
import { AdminService, CommunityService, type CommunityDeps } from "./community/communityService";
import type { Announcement, DayTelemetry, FeedbackEntry, TelemetryStats } from "@/domain/community";
import { DialogueService, parseDialogueQuery } from "./dialogue/dialogueService";
import { GameController } from "./game/gameController";
import type { ShopEvent } from "./game/shopSession";
import type { CloudSaveGateway, CloudSaveStore, CommunityGateway, FeedbackStore, SaveRepository } from "./ports";

class MemorySaves implements SaveRepository {
  data: SaveData | null = null;
  load = () => (this.data ? structuredClone(this.data) : null);
  save = (d: SaveData) => ((this.data = structuredClone(d)), true);
  clear = () => void (this.data = null);
}

function makeGame(opts: { saves?: MemorySaves; cloud?: Partial<CloudSaveGateway>; community?: Partial<CommunityGateway>; rng?: () => number } = {}) {
  const saves = opts.saves ?? new MemorySaves();
  const game = new GameController({
    saves,
    cloud: { upload: async () => ({ ok: true, value: null }), download: async () => ({ ok: false, message: "x" }), ...opts.cloud },
    recoveryCode: { get: () => "AAAA-BBBB-CCCC", set: () => {} },
    dialogue: { line: async () => null },
    community: { sendFeedback: async () => ({ ok: true, value: null }), sendTelemetry: async () => {}, announcement: async () => null, ...opts.community },
    rng: opts.rng ?? (() => 0.42),
    prefersReducedMotion: () => false,
  });
  game.init();
  game.setLoadProgress(1);
  return { game, saves };
}

/** Advance the simulation in 0.1s frames until `until` is true. */
function run(game: GameController, until: () => boolean, maxSec = 600) {
  for (let t = 0; t < maxSec * 10 && !until(); t++) game.session.tick(0.1);
}

describe("GameController flow", () => {
  it("goes menu → prep → open → summary and persists the day", () => {
    const { game, saves } = makeGame();
    expect(game.phase).toBe("menu");
    game.newGame();
    expect(game.phase).toBe("prep");
    game.openShop();
    expect(game.phase).toBe("open");
    game.requestEndDay();
    run(game, () => game.phase === "summary");
    expect(game.phase).toBe("summary");
    expect(game.save.day).toBe(2);
    expect(saves.data?.day).toBe(2);
    expect(saves.data?.nightPending).toBe(true);
    game.nextDay();
    expect(game.phase).toBe("night");
    game.endNight(0);
    expect(game.lastNight?.robbed).toBe(false);
    expect(saves.data?.nightPending).toBe(false);
    game.startMorning();
    expect(game.phase).toBe("prep");
    expect(game.save.plan?.day).toBe(2);
  });

  it("resumes an unresolved night after a reload instead of skipping it", () => {
    const saves = new MemorySaves();
    const a = makeGame({ saves }).game;
    a.newGame();
    a.openShop();
    a.requestEndDay();
    run(a, () => a.phase === "summary");
    const b = makeGame({ saves }).game;
    b.continueGame();
    expect(b.phase).toBe("night");
  });

  it("a robbery that leaves the rent unpaid forces a bank loan, never a wiped save", () => {
    const saves = new MemorySaves();
    const { game } = makeGame({ saves, rng: () => 0 });
    game.newGame();
    Object.assign(game.save, { day: 8, money: 900, tutorialDone: true, nightPending: true });
    game.continueGame();
    game.endNight(0);
    expect(game.lastNight?.robbed).toBe(true);
    expect(game.save.money).toBe(0);
    game.startMorning();
    expect(game.phase).toBe("bankrupt");
    expect(saves.data?.day).toBe(8);
    game.takeLoan();
    expect(game.phase).toBe("prep");
    expect(game.save.money).toBeGreaterThan(0);
    expect(game.save.loan).not.toBeNull();
  });

  it("the rival strikes mid-day, pauses for a choice and its effects apply", () => {
    const { game } = makeGame({ rng: () => 0 });
    game.newGame();
    Object.assign(game.save, { day: 5, tutorialDone: true, money: 500 });
    game.save.plan = { day: 5, weather: "sunny", goal: { kind: "served", target: 99, reward: 1 }, rival: "trash", rivalAt: 0.05, visitor: null, visitorDone: false };
    game.openShop();
    run(game, () => game.modal === "rival");
    expect(game.rivalEvent).toBe("trash");
    expect(game.running).toBe(false);
    expect(game.session.trash.length).toBe(6);
    expect(game.chooseRival(1)).toBe(true);
    expect(game.save.money).toBe(430);
    expect(game.session.trash).toEqual([]);
    expect(game.running).toBe(true);
    expect(game.dayStats.otherCosts).toBe(70);
  });

  it("players can sweep rubbish piece by piece", () => {
    const { game } = makeGame({ rng: () => 0 });
    game.newGame();
    Object.assign(game.save, { day: 5, tutorialDone: true });
    game.save.plan = { day: 5, weather: "sunny", goal: { kind: "served", target: 99, reward: 1 }, rival: "trash", rivalAt: 0.05, visitor: null, visitorDone: false };
    game.openShop();
    run(game, () => game.modal === "rival");
    game.chooseRival(0);
    for (const t of [...game.session.trash]) game.session.sweep(t.id);
    expect(game.session.trash).toEqual([]);
  });


  it("closing early ends the day even while a customer is still walking in", () => {
    const { game } = makeGame();
    game.newGame();
    game.openShop();
    run(game, () => game.session.customers[0]?.data.state === "approaching");
    expect(game.session.customers[0]?.data.state).toBe("approaching");
    game.requestEndDay();
    run(game, () => game.phase === "summary", 30);
    expect(game.phase).toBe("summary");
  });

  it("does not advance while paused or a modal is open", () => {
    const { game } = makeGame();
    game.newGame();
    game.openShop();
    game.openModal("pause");
    expect(game.running).toBe(false);
    game.session.takeCup("M");
    expect(game.session.cup).toBeNull();
    game.closeModal();
    game.session.takeCup("M");
    expect(game.session.cup).not.toBeNull();
  });

  it("restores a cloud save only when it is valid", async () => {
    const good = defaultSave();
    good.money = 999;
    const { game } = makeGame({ cloud: { download: async () => ({ ok: true, value: good }) } });
    expect(await game.cloudRestore("aaaa-bbbb-cccc")).toBe(true);
    expect(game.save.money).toBe(999);
    const bad = makeGame({ cloud: { download: async () => ({ ok: true, value: { hacked: true } }) } }).game;
    expect(await bad.cloudRestore("AAAA-BBBB-CCCC")).toBe(false);
  });
});

describe("ShopSession tutorial order", () => {
  it("plays the full first order through commands and pays for it", () => {
    const { game } = makeGame();
    game.newGame();
    game.openShop();
    const events: ShopEvent["type"][] = [];
    game.session.events.on((e) => events.push(e.type));
    const s = game.session;

    run(game, () => s.customers[0]?.data.state === "ordering");
    const cat = s.customers[0];
    expect(cat.data.archetype).toBe("regular");
    expect(s.hint?.step).toBe(1);

    s.tapCustomer(cat.data.id);
    expect(s.selectedId).toBe(cat.data.id);
    s.takeCup("M");
    s.startPour("tea_black");
    run(game, () => s.cup!.tea.tea_black >= 0.6);
    s.stopPour();
    s.startPour("milk");
    run(game, () => s.cup!.milk >= 0.4);
    s.stopPour();
    s.pumpSugar();
    s.scoopIce();
    s.addTopping("top_boba");
    s.sealCup();
    run(game, () => !!s.cup?.sealed);
    expect(s.hint?.step).toBe(9);

    const money = game.save.money;
    s.deliver(cat.data.id);
    expect(game.save.tutorialDone).toBe(true);
    expect(game.save.money).toBeGreaterThan(money);
    expect(game.dayStats.served).toBe(1);
    expect(events).toContain("served");

    run(game, () => s.customers.length === 0, 10);
    expect(events).toContain("gone");
  });

  it("a shipper takes several cups one by one and the app keeps 20% of each", () => {
    // rng 0.01: every arrival is a shipper (one at a time), brand grab, 2 cups.
    const { game } = makeGame({ rng: () => 0.01 });
    game.newGame();
    Object.assign(game.save, { day: 4, tutorialDone: true, plan: null });
    game.openShop();
    const s = game.session;
    const events: ShopEvent["type"][] = [];
    s.events.on((e) => events.push(e.type));
    run(game, () => s.customers.some((c) => c.data.state === "ordering"));
    const shippers = s.customers.filter((c) => c.data.delivery);
    expect(shippers).toHaveLength(1);
    const cat = shippers[0];
    const d = cat.data.delivery!;
    expect(d.brand).toBe("grab");
    expect(d.orders).toHaveLength(2);
    s.tapCustomer(cat.data.id);

    const brew = () => {
      s.takeCup("M");
      s.startPour("tea_black");
      run(game, () => s.cup!.tea.tea_black >= 0.5);
      s.stopPour();
      s.sealCup();
      run(game, () => !!s.cup?.sealed);
      s.deliver(cat.data.id);
    };
    brew();
    expect(d.done).toBe(1);
    expect(cat.data.state).toBe("waiting");
    expect(cat.data.order).toBe(d.orders[1]);
    expect(events).toContain("nextCup");
    brew();
    expect(cat.data.state).toBe("receiving");
    expect(game.dayStats.deliveries).toBe(2);
    expect(game.dayStats.revenue).toBeGreaterThan(0);
    expect(game.dayStats.commission).toBe(Math.round((game.dayStats.revenue + game.dayStats.commission) * 0.2 / 2) * 2);
  });

  it("special guests: granny gives a gift, a great drink makes the TikToker go viral", async () => {
    const { LEVEL_UNITS, RECIPE_BY_ID } = await import("@/domain/catalog");
    const { GRANNY_GIFT, VIRAL } = await import("@/domain/guests");
    // rng 0.05: the first arrival is a shipper (one at a time), then the TikToker, then the granny.
    const { game } = makeGame({ rng: () => 0.05 });
    game.newGame();
    Object.assign(game.save, { day: 4, tutorialDone: true, plan: null, reputation: 40 });
    game.save.inventory.top_boba = 10;
    game.openShop();
    const s = game.session;
    const brew = (id: number) => {
      const o = s.customers.find((c) => c.data.id === id)!.data.order;
      const r = RECIPE_BY_ID[o.recipeId];
      s.tapCustomer(id);
      s.takeCup(o.size);
      s.startPour(r.tea);
      run(game, () => s.cup!.tea[r.tea] >= r.teaRatio - 0.02);
      s.stopPour();
      if (r.milkRatio > 0) {
        s.startPour("milk");
        run(game, () => s.cup!.milk + s.cup!.tea[r.tea] >= 0.99);
        s.stopPour();
      }
      for (let i = 0; i < LEVEL_UNITS[o.sugar]; i++) s.pumpSugar();
      for (let i = 0; i < LEVEL_UNITS[o.ice]; i++) s.scoopIce();
      if (r.topping) s.addTopping(r.topping);
      s.sealCup();
      run(game, () => !!s.cup?.sealed);
      s.deliver(id);
    };
    const seen = new Set<string>();
    for (let k = 0; k < 2; k++) {
      run(game, () => s.customers.some((c) => c.data.state === "ordering" && (c.data.archetype === "granny" || c.data.archetype === "tiktoker") && !seen.has(c.data.archetype)), 900);
      const g = s.customers.find((c) => c.data.state === "ordering" && !seen.has(c.data.archetype) && (c.data.archetype === "granny" || c.data.archetype === "tiktoker"));
      if (!g) break;
      seen.add(g.data.archetype);
      const rep = game.save.reputation;
      const boba = game.save.inventory.top_boba;
      brew(g.data.id);
      if (g.data.archetype === "granny") {
        expect(game.save.inventory.top_boba).toBeGreaterThanOrEqual(boba + GRANNY_GIFT.amount - 1);
        expect(game.save.reputation).toBeGreaterThan(rep);
      } else {
        expect(s.mod("spawnMul")).toBe(VIRAL.spawnMul);
        expect(game.save.reputation).toBeGreaterThanOrEqual(rep + VIRAL.reputation);
      }
    }
    expect([...seen].sort()).toEqual(["granny", "tiktoker"]);
  });

  it("morning visitors: a lottery ticket bought at prep is drawn when the shop closes", async () => {
    const { LOTTERY_PRICE, LOTTERY_PRIZES } = await import("@/domain/visitors");
    const { game } = makeGame({ rng: () => 0 });
    game.newGame();
    Object.assign(game.save, { day: 5, tutorialDone: true, money: 200 });
    game.save.plan = { day: 5, weather: "sunny", goal: { kind: "served", target: 99, reward: 1 }, rival: null, rivalAt: 0.5, visitor: "lottery", visitorDone: false };
    game.buyLottery();
    game.buyLottery();
    expect(game.save.money).toBe(200 - LOTTERY_PRICE);
    game.openShop();
    game.requestEndDay();
    run(game, () => game.phase === "summary");
    expect(game.lastSummary?.lottery?.amount).toBe(LOTTERY_PRIZES[0].amount);
    expect(game.save.lotteryDay).toBe(0);
    expect(game.save.money).toBeGreaterThanOrEqual(200 - LOTTERY_PRICE + LOTTERY_PRIZES[0].amount);
  });

  it("morning visitors: the stray kitten is fed only from the prep screen", () => {
    const { game } = makeGame();
    game.newGame();
    Object.assign(game.save, { day: 3, tutorialDone: true });
    game.save.plan = { day: 3, weather: "sunny", goal: { kind: "served", target: 9, reward: 1 }, rival: null, rivalAt: 0.5, visitor: "stray", visitorDone: false };
    const milk = game.save.inventory.milk;
    game.feedStray();
    expect(game.save.strayFed).toBe(1);
    expect(game.save.inventory.milk).toBe(milk - 1);
    expect(game.save.plan.visitorDone).toBe(true);
  });

  it("shakes the cup over time, blocks pouring meanwhile, and refuses after sealing", () => {
    const { game } = makeGame();
    game.newGame();
    game.save.tutorialDone = true;
    game.openShop();
    const s = game.session;
    const actions: string[] = [];
    s.events.on((e) => e.type === "cup" && actions.push(e.action));
    s.takeCup("L");
    s.shakeCup();
    expect(s.shaking).toBe(false);
    s.startPour("tea_green");
    run(game, () => s.cup!.tea.tea_green >= 0.5);
    s.stopPour();
    s.shakeCup();
    expect(s.shaking).toBe(true);
    s.startPour("tea_green");
    expect(s.pouring).toBe(null);
    run(game, () => !!s.cup?.shaken, 5);
    expect(s.shaking).toBe(false);
    expect(actions).toEqual(expect.arrayContaining(["shakeStart", "shaken"]));
    s.sealCup();
    run(game, () => !!s.cup?.sealed, 5);
    s.shakeCup();
    expect(s.shaking).toBe(false);
  });

  it("rejects actions without a cup and reports them", () => {
    const { game } = makeGame();
    game.newGame();
    game.openShop();
    const rejected = vi.fn();
    game.session.events.on((e) => e.type === "rejected" && rejected());
    game.session.pumpSugar();
    expect(rejected).toHaveBeenCalledOnce();
    expect(game.notices.items.at(-1)?.kind).toBe("bad");
  });
});

describe("server use cases", () => {
  const limiter = { allow: async () => true };

  it("cloud save validates codes and payloads", async () => {
    const mem = new Map<string, unknown>();
    const store: CloudSaveStore = { get: async (c) => mem.get(c) ?? null, put: async (c, d) => void mem.set(c, d) };
    const svc = new CloudSaveService({ store, limiter, now: () => 1 });
    expect((await svc.load("nope", "ip")).ok).toBe(false);
    expect(await svc.store(JSON.stringify({ code: "AAAA-BBBB-CCCC", save: { version: 1, money: 7 } }), "ip")).toEqual({ ok: true, value: { updatedAt: 1 } });
    const loaded = await svc.load("aaaa-bbbb-cccc", "ip");
    expect(loaded.ok && loaded.value.money).toBe(7);
    expect((await svc.store("{", "ip")).ok).toBe(false);
    const off = new CloudSaveService({ store: null, limiter, now: () => 1 });
    expect(await off.load("AAAA-BBBB-CCCC", "ip")).toMatchObject({ ok: false, status: 503 });
  });

  it("dialogue falls back when the AI fails and sanitizes AI output", async () => {
    const q = parseDialogueQuery({ archetype: "office", event: "happy", recipeId: "boba" })!;
    expect(parseDialogueQuery({ archetype: "dog", event: "happy" })).toBeNull();
    const down = new DialogueService({ generator: { generate: async () => null }, cache: null, limiter, rng: () => 0 });
    expect((await down.line(q, "ip")).source).toBe("fallback");
    const up = new DialogueService({ generator: { generate: async () => 'Mèo: "Ngon tuyệt meo!"' }, cache: null, limiter, rng: () => 0 });
    expect(await up.line(q, "ip")).toEqual({ line: "Ngon tuyệt meo!", source: "ai" });
  });
});

class MemoryFeedback implements FeedbackStore {
  rows = new Map<number, FeedbackEntry>();
  seq = 0;
  add = async (e: Omit<FeedbackEntry, "id">) => {
    const full = { ...e, id: ++this.seq };
    this.rows.set(full.id, full);
    return full;
  };
  recent = async (max: number) => [...this.rows.values()].sort((a, b) => b.id - a.id).slice(0, max);
  get = async (id: number) => this.rows.get(id) ?? null;
  update = async (e: FeedbackEntry) => void this.rows.set(e.id, e);
  remove = async (id: number) => this.rows.delete(id);
}

function communityDeps(over: Partial<CommunityDeps> = {}): CommunityDeps {
  let ann: Announcement | null = null;
  const reports: DayTelemetry[] = [];
  return {
    feedback: new MemoryFeedback(),
    telemetry: { record: async (r) => void reports.push(r), stats: async (): Promise<TelemetryStats> => ({ days: [], daily: [] }) },
    announcement: { get: async () => ann, set: async (a) => void (ann = a), clear: async () => void (ann = null) },
    saves: null,
    limiter: { allow: async () => true },
    now: () => 1_000_000,
    version: "test",
    ...over,
  };
}

describe("community and admin use cases", () => {
  const fb = { category: "bug", message: "  Ly bị tràn  ", rating: 4, context: { day: 3, money: 120, reputation: 55.7, phase: "open", screen: "open" } };

  it("validates, stores and rate-limits feedback", async () => {
    const deps = communityDeps();
    const svc = new CommunityService(deps);
    expect(await svc.submitFeedback(fb, "ip", "UA")).toEqual({ ok: true, value: { id: 1 } });
    const saved = await deps.feedback!.get(1);
    expect(saved).toMatchObject({ message: "Ly bị tràn", rating: 4, handled: false, version: "test", userAgent: "UA" });
    expect(saved?.context.reputation).toBe(55);
    expect((await svc.submitFeedback({ ...fb, category: "spam" }, "ip", "")).ok).toBe(false);
    expect((await svc.submitFeedback({ ...fb, message: "a" }, "ip", "")).ok).toBe(false);
    expect((await svc.submitFeedback({ ...fb, rating: 9 }, "ip", "")).ok).toBe(true);
    expect((await deps.feedback!.get(2))?.rating).toBeNull();
    const limited = new CommunityService(communityDeps({ limiter: { allow: async () => false } }));
    expect(await limited.submitFeedback(fb, "ip", "")).toMatchObject({ ok: false, status: 429 });
    expect(await new CommunityService(communityDeps({ feedback: null })).submitFeedback(fb, "ip", "")).toMatchObject({ ok: false, status: 503 });
  });

  it("lets the admin filter, mark and delete feedback", async () => {
    const deps = communityDeps();
    const svc = new CommunityService(deps);
    await svc.submitFeedback(fb, "ip", "");
    await svc.submitFeedback({ ...fb, category: "idea" }, "ip", "");
    const admin = new AdminService(deps);
    expect((await admin.setHandled(1, true)).ok).toBe(true);
    const open = await admin.listFeedback({ handled: false, limit: 10 });
    expect(open.ok && open.value.items.map((e) => e.id)).toEqual([2]);
    const bugs = await admin.listFeedback({ category: "bug", limit: 10 });
    expect(bugs.ok && [bugs.value.items.length, bugs.value.total, bugs.value.open]).toEqual([1, 2, 1]);
    expect((await admin.deleteFeedback(2)).ok).toBe(true);
    expect(await admin.deleteFeedback(2)).toMatchObject({ ok: false, status: 404 });
    expect(await admin.setHandled(99, true)).toMatchObject({ ok: false, status: 404 });
  });

  it("posts, expires and clears the announcement", async () => {
    let now = 1_000_000;
    const deps = communityDeps({ now: () => now });
    const admin = new AdminService(deps);
    const pub = new CommunityService(deps);
    expect((await admin.postAnnouncement({ text: "  ", tone: "info" })).ok).toBe(false);
    expect((await admin.postAnnouncement({ text: "Sự kiện Trung thu!", tone: "event", hours: 2 })).ok).toBe(true);
    expect((await pub.currentAnnouncement())?.tone).toBe("event");
    now += 3 * 3600_000;
    expect(await pub.currentAnnouncement()).toBeNull();
    await admin.postAnnouncement({ text: "Bảo trì", tone: "nope" });
    expect((await pub.currentAnnouncement())?.tone).toBe("info");
    await admin.clearAnnouncement();
    expect(await pub.currentAnnouncement()).toBeNull();
  });

  it("validates telemetry and looks up saves by recovery code", async () => {
    const recorded: [DayTelemetry, string][] = [];
    const deps = communityDeps({
      telemetry: { record: async (r, d) => void recorded.push([r, d]), stats: async () => ({ days: [], daily: [] }) },
      saves: { get: async (code) => (code === "AAAA-BBBB-CCCC" ? { version: 1, day: 4, money: 50 } : null), put: async () => {} },
      now: () => Date.UTC(2026, 9, 26, 12),
    });
    const pub = new CommunityService(deps);
    expect((await pub.recordTelemetry({ day: 0 }, "ip")).ok).toBe(false);
    expect((await pub.recordTelemetry({ day: 2, served: 9999, profit: -40, avgQuality: 81.6 }, "ip")).ok).toBe(true);
    expect(recorded[0][1]).toBe("2026-10-26");
    expect(recorded[0][0]).toMatchObject({ day: 2, served: 500, profit: -40, avgQuality: 81 });
    const admin = new AdminService(deps);
    const hit = await admin.lookupSave("aaaa-bbbb-cccc");
    expect(hit.ok && [hit.value.save.day, hit.value.save.money]).toEqual([4, 50]);
    expect(await admin.lookupSave("ZZZZ-ZZZZ-ZZZZ")).toMatchObject({ ok: false, status: 404 });
    expect(await admin.lookupSave("bad")).toMatchObject({ ok: false, status: 400 });
  });

  it("game sends telemetry at closing unless turned off, and feedback with context", async () => {
    const sent: DayTelemetry[] = [];
    const feedback: unknown[] = [];
    const { game } = makeGame({
      community: {
        sendTelemetry: async (r) => void sent.push(r),
        sendFeedback: async (f) => (feedback.push(f), { ok: true, value: null }),
      },
    });
    game.newGame();
    game.openShop();
    game.requestEndDay();
    run(game, () => game.phase === "summary");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ day: 1, money: game.save.money });
    expect(await game.sendFeedback("idea", "Thêm trà đào", 5, "summary")).toBe(true);
    expect(feedback[0]).toMatchObject({ category: "idea", rating: 5, context: { day: 2, phase: "summary" } });
    game.updateSettings({ telemetry: false });
    game.nextDay();
    game.endNight(0);
    game.startMorning();
    game.openShop();
    game.requestEndDay();
    run(game, () => game.phase === "summary");
    expect(sent).toHaveLength(1);
  });
});
