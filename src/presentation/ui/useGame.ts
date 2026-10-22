"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { GameController } from "@/application/game/gameController";

export const GameContext = createContext<GameController | null>(null);

/** Returns the controller and re-renders whenever its state changes. */
export function useGame(): GameController {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame must be used inside <GameContext>");
  useSyncExternalStore(game.subscribe, game.getVersion, game.getVersion);
  return game;
}
