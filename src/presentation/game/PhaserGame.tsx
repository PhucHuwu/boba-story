"use client";

import * as Phaser from "phaser";
import { useEffect, useRef } from "react";
import type { GameController } from "@/application/game/gameController";
import type { Layout } from "./layout";
import { ShopScene } from "./ShopScene";

function createGame(parent: HTMLElement, controller: GameController, layout: Layout) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#2a1810",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: layout.width, height: layout.height },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 2 },
    scene: [new ShopScene(controller, layout)],
    banner: false,
  });
}

/** Mounts the Phaser canvas (client-only). Remount (via `key`) when the layout changes. */
export default function PhaserGame({ controller, layout }: { controller: GameController; layout: Layout }) {
  const parent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = parent.current;
    if (!el) return;
    let game: Phaser.Game | undefined;
    let cancelled = false;
    // Canvas text is rasterized with whatever font is loaded, so wait for the web font first.
    void document.fonts.ready.then(() => {
      if (!cancelled) game = createGame(el, controller, layout);
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, [controller, layout]);

  return <div ref={parent} className="absolute inset-0" aria-label="Màn chơi Boba Story" />;
}
