import { describe, expect, it, vi } from "vitest";
import { defaultSave } from "@/domain/catalog";
import type { SaveData } from "@/domain/types";
import { CloudSaveService } from "./cloud/cloudSaveService";
import { DialogueService, parseDialogueQuery } from "./dialogue/dialogueService";
import { GameController } from "./game/gameController";
import type { ShopEvent } from "./game/shopSession";
import type { CloudSaveGateway, CloudSaveStore, SaveRepository } from "./ports";

class MemorySaves implements SaveRepository {
  data: SaveData | null = null;
  load = () => (this.data ? structuredClone(this.data) : null);
  save = (d: SaveData) => ((this.data = structuredClone(d)), true);
  clear = () => void (this.data = null);
}

function makeGame(opts: { saves?: MemorySaves; cloud?: Partial<CloudSaveGateway>; rng?: () => number } = {}) {
  const saves = opts.saves ?? new MemorySaves();
  const game = new GameController({
    saves,
    cloud: { upload: async () => ({ ok: true, value: null }), download: async () => ({ ok: false, message: "x" }), ...opts.cloud },
    recoveryCode: { get: () => "AAAA-BBBB-CCCC", set: () => {} },
    dialogue: { line: async () => null },
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
    game.save.plan = { day: 5, weather: "sunny", goal: { kind: "served", target: 99, reward: 1 }, rival: "trash", rivalAt: 0.05 };
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
    game.save.plan = { day: 5, weather: "sunny", goal: { kind: "served", target: 99, reward: 1 }, rival: "trash", rivalAt: 0.05 };
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
