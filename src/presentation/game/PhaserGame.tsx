"use client";

import * as Phaser from "phaser";
import { useEffect, useRef } from "react";
import type { GameController } from "@/application/game/gameController";
import { GAME_H, GAME_W } from "./layout";
import { ShopScene } from "./ShopScene";

/** Mounts the Phaser canvas (client-only). Scale.FIT keeps the 9:16 stage letterboxed on any screen. */
export default function PhaserGame({ controller }: { controller: GameController }) {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!parent.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parent.current,
      backgroundColor: "#2a1810",
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: GAME_W, height: GAME_H },
      render: { antialias: true, roundPixels: false },
      input: { activePointers: 2 },
      scene: [new ShopScene(controller)],
      banner: false,
    });
    return () => game.destroy(true);
  }, [controller]);

  return <div ref={parent} className="absolute inset-0" aria-label="Màn chơi Boba Story" />;
}
