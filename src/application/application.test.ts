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

function makeGame(opts: { saves?: MemorySaves; cloud?: Partial<CloudSaveGateway> } = {}) {
  const saves = opts.saves ?? new MemorySaves();
  const game = new GameController({
    saves,
    cloud: { upload: async () => ({ ok: true, value: null }), download: async () => ({ ok: false, message: "x" }), ...opts.cloud },
    recoveryCode: { get: () => "AAAA-BBBB-CCCC", set: () => {} },
    dialogue: { line: async () => null },
    rng: () => 0.42,
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
    game.nextDay();
    expect(game.phase).toBe("prep");
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
