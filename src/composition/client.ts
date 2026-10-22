import { GameController } from "@/application/game/gameController";
import { HttpCloudSaveGateway, HttpDialogueGateway } from "@/infrastructure/browser/httpGateways";
import { LocalStorageRecoveryCode, LocalStorageSaveRepository } from "@/infrastructure/browser/localStorageSaves";

/** Client composition root: builds the game once per page with browser adapters. */
let game: GameController | undefined;

export function getGame(): GameController {
  return (game ??= new GameController({
    saves: new LocalStorageSaveRepository(),
    cloud: new HttpCloudSaveGateway(),
    recoveryCode: new LocalStorageRecoveryCode(),
    dialogue: new HttpDialogueGateway(),
    rng: Math.random,
    prefersReducedMotion: () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  }));
}
