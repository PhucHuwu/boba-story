"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { getGame } from "@/composition/client";
import { audio } from "../game/audio";
import { LAYOUTS } from "../game/layout";
import { BankruptScreen, NightScreen } from "./features";
import { HintBar, Hud, Toasts, unlockAudioOnce } from "./hud";
import { Modals } from "./modals";
import { LoadingScreen, MainMenu, PrepScreen, SummaryScreen } from "./screens";
import { GameContext, useGame } from "./useGame";
import { LayoutContext, useLayout, useViewportLayoutKind } from "./useLayout";

const PhaserGame = dynamic(() => import("../game/PhaserGame"), { ssr: false });

/** Base UI text size in canvas px; converted to container units so it scales with the stage. */
const UI_FONT_CANVAS_PX = 23.8;

function Overlays() {
  const game = useGame();
  const L = useLayout();
  const { music, sfx } = game.save.settings;
  useEffect(() => audio.setVolumes(music, sfx), [music, sfx]);
  useEffect(unlockAudioOnce, []);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ fontSize: `clamp(11px, ${((UI_FONT_CANVAS_PX / L.width) * 100).toFixed(3)}cqw, 26px)` }}
    >
      {game.phase === "loading" && <LoadingScreen />}
      {game.phase === "menu" && <MainMenu />}
      {(game.phase === "prep" || game.phase === "open") && <Hud />}
      {game.phase === "prep" && <PrepScreen />}
      {game.phase === "summary" && <SummaryScreen />}
      {game.phase === "night" && <NightScreen />}
      {game.phase === "bankrupt" && <BankruptScreen />}
      <HintBar />
      <Modals />
      <Toasts />
    </div>
  );
}

/**
 * Root of the game UI. The stage box keeps the active layout's aspect ratio so React overlays line up
 * with the Phaser canvas (Scale.FIT inside the same box). Phones get the tall layout, iPad portrait a
 * 3:4-ish one and landscape screens a side-by-side one; rotating the device swaps layouts.
 */
export default function GameApp() {
  const [game] = useState(getGame);
  useEffect(() => game.init(), [game]);

  const kind = useViewportLayoutKind();
  const L = LAYOUTS[kind ?? "phone"];

  // Rotating mid-day remounts the scene; pause so the player doesn't lose time while re-orienting.
  const prevKind = useRef(kind);
  useEffect(() => {
    if (prevKind.current && kind && prevKind.current !== kind && game.isInteractive()) game.openModal("pause");
    prevKind.current = kind;
  }, [kind, game]);

  const ratio = L.width / L.height;
  return (
    <GameContext value={game}>
      <LayoutContext value={L}>
        <main className="flex h-dvh w-screen items-center justify-center overflow-hidden">
          <div
            data-layout={L.kind}
            className="group/stage relative overflow-hidden bg-[#2a1810] shadow-2xl [container-type:size]"
            style={{ width: `min(100vw, calc(100dvh * ${ratio}))`, height: `min(100dvh, calc(100vw / ${ratio}))` }}
          >
            {kind && <PhaserGame key={L.kind} controller={game} layout={L} />}
            <Overlays />
          </div>
        </main>
      </LayoutContext>
    </GameContext>
  );
}
