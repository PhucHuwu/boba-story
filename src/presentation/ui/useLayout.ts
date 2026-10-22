"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { LAYOUTS, type Layout, type LayoutKind, pickLayoutKind } from "../game/layout";

export const LayoutContext = createContext<Layout>(LAYOUTS.phone);

/** The active stage layout (shared by the Phaser scene and the React overlays). */
export function useLayout(): Layout {
  return useContext(LayoutContext);
}

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

const viewportKind = (): LayoutKind => pickLayoutKind(window.innerWidth, window.innerHeight);

/** Follows the viewport (resize / device rotation) and returns the best-fitting layout kind. */
export function useViewportLayoutKind(): LayoutKind | null {
  return useSyncExternalStore(subscribe, viewportKind, () => null);
}

/** Converts canvas units to a % of the stage so overlays line up with the canvas. */
export const pctX = (L: Layout, x: number) => `${(x / L.width) * 100}%`;
export const pctY = (L: Layout, y: number) => `${(y / L.height) * 100}%`;
