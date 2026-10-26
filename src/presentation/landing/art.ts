import manifest from "../game/assetManifest.json";

const PATHS: Record<string, string> = manifest;

/** URL of a generated image by key. Plain module (not "use client") so server components can call it. */
export const art = (key: string) => `/assets/${PATHS[key] ?? `${key}.webp`}`;
