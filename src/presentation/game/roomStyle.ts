export type RoomStyle = "iso" | "flat";

/**
 * Which room the shop renders: the 2.5D isometric room (default) or the old 2D close-up.
 * `?room=iso|flat` in the URL switches and is remembered on this device.
 */
export function roomStyle(): RoomStyle {
  if (typeof window === "undefined") return "iso";
  const asked = new URLSearchParams(window.location.search).get("room");
  try {
    if (asked === "iso" || asked === "flat") localStorage.setItem("boba-room-style", asked);
    return localStorage.getItem("boba-room-style") === "flat" ? "flat" : "iso";
  } catch {
    return asked === "flat" ? "flat" : "iso";
  }
}
