import type { StationId } from "./layout";

/** Keyboard shortcuts for the counter (KeyboardEvent.code → station). Holding a pour key keeps pouring. */
export const STATION_KEYS: { code: string; label: string; station: StationId }[] = [
  { code: "KeyQ", label: "Q", station: "tea_black" },
  { code: "KeyW", label: "W", station: "tea_green" },
  { code: "KeyE", label: "E", station: "tea_oolong" },
  { code: "KeyR", label: "R", station: "milk" },
  { code: "KeyS", label: "S", station: "sugar" },
  { code: "KeyD", label: "D", station: "ice" },
  { code: "KeyM", label: "M", station: "cup_M" },
  { code: "KeyL", label: "L", station: "cup_L" },
  { code: "KeyZ", label: "Z", station: "top_boba" },
  { code: "KeyX", label: "X", station: "top_jelly" },
  { code: "KeyC", label: "C", station: "top_pudding" },
  { code: "KeyA", label: "A", station: "shaker" },
  { code: "KeyF", label: "F", station: "sealer" },
];

export const KEY_BY_STATION = Object.fromEntries(STATION_KEYS.map((k) => [k.station, k.label])) as Partial<Record<StationId, string>>;

/** Rows for the shortcut list in the pause menu. */
export const SHORTCUT_HELP: [string, string][] = [
  ["1 – 4", "Chọn mèo khách theo chỗ đứng (trái sang phải)"],
  ["Q / W / E", "Rót trà đen / trà xanh / ô long (giữ phím)"],
  ["R", "Rót sữa (giữ phím)"],
  ["S / D", "Thêm đường / đá"],
  ["M / L", "Lấy ly M / L"],
  ["Z / X / C", "Trân châu / thạch dừa / pudding"],
  ["A / F", "Lắc / dán nắp"],
  ["Space", "Giao ly cho khách đang chọn"],
  ["Delete", "Bỏ ly đang pha"],
  ["Esc", "Hủy thao tác đang làm, hoặc tạm dừng"],
];
