import { GameController } from "@/application/game/gameController";
import { HttpCloudSaveGateway, HttpCommunityGateway, HttpDialogueGateway } from "@/infrastructure/browser/httpGateways";
import { LocalStorageRecoveryCode, LocalStorageSaveRepository } from "@/infrastructure/browser/localStorageSaves";

/** Browser adapters used by the landing page (no game controller needed there). */
export const landingCommunity = new HttpCommunityGateway();

/** Summary of the save on this device, or null when there is none. Reads localStorage, so call it client-side only. */
export function localSaveSummary(): { day: number; money: number; reputation: number } | null {
  const s = new LocalStorageSaveRepository().load();
  return s ? { day: s.day, money: Math.floor(s.money), reputation: Math.floor(s.reputation) } : null;
}

/** Client composition root: builds the game once per page with browser adapters. */
let game: GameController | undefined;

export function getGame(): GameController {
  return (game ??= new GameController({
    saves: new LocalStorageSaveRepository(),
    cloud: new HttpCloudSaveGateway(),
    recoveryCode: new LocalStorageRecoveryCode(),
    dialogue: new HttpDialogueGateway(),
    community: new HttpCommunityGateway(),
    rng: Math.random,
    prefersReducedMotion: () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  }));
}
