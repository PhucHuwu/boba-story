"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getGame } from "@/composition/client";
import { audio } from "../game/audio";
import { HintBar, Hud, Toasts, unlockAudioOnce } from "./hud";
import { Modals } from "./modals";
import { LoadingScreen, MainMenu, PrepScreen, SummaryScreen } from "./screens";
import { GameContext, useGame } from "./useGame";

const PhaserGame = dynamic(() => import("../game/PhaserGame"), { ssr: false });

function Overlays() {
  const game = useGame();
  const { music, sfx } = game.save.settings;
  useEffect(() => audio.setVolumes(music, sfx), [music, sfx]);
  useEffect(unlockAudioOnce, []);

  return (
    <div className="pointer-events-none absolute inset-0 text-[clamp(11px,3.3cqw,22px)]">
      {game.phase === "loading" && <LoadingScreen />}
      {game.phase === "menu" && <MainMenu />}
      {(game.phase === "prep" || game.phase === "open") && <Hud />}
      {game.phase === "prep" && <PrepScreen />}
      {game.phase === "summary" && <SummaryScreen />}
      <HintBar />
      <Modals />
      <Toasts />
    </div>
  );
}

/**
 * Root of the game UI. The stage keeps a 9:16 box so React overlays line up with the Phaser canvas
 * (which uses Scale.FIT inside the same box).
 */
export default function GameApp() {
  const [game] = useState(getGame);
  useEffect(() => game.init(), [game]);

  return (
    <GameContext value={game}>
      <main className="flex h-dvh w-screen items-center justify-center overflow-hidden">
        <div className="relative h-[min(100dvh,calc(100vw*16/9))] w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-[#2a1810] shadow-2xl [container-type:size]">
          <PhaserGame controller={game} />
          <Overlays />
        </div>
      </main>
    </GameContext>
  );
}
