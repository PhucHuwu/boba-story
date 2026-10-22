import { liquidTotal } from "@/domain/cup";
import type { CupState } from "@/domain/types";
import type { ShopCustomer } from "./shopSession";

/** What the tutorial wants the player to touch. The view maps targets to screen positions. */
export type HintTarget =
  | { kind: "station"; id: "cup_M" | "tea_black" | "milk" | "sugar" | "ice" | "top_boba" | "sealer" }
  | { kind: "card"; customerId: number }
  | { kind: "customer"; customerId: number }
  | null;

export interface Hint {
  text: string;
  step: number;
  total: number;
  target: HintTarget;
}

export const TUTORIAL_STEPS = 9;

/** Scripted first order: the next instruction given the current state of the counter. */
export function tutorialHint(c: ShopCustomer | undefined, cup: CupState | null): Hint {
  const h = (step: number, text: string, target: HintTarget): Hint => ({ step, text, target, total: TUTORIAL_STEPS });
  if (!c || c.data.state === "approaching") return h(0, "Mèo khách đầu tiên đang đến quán...", null);
  const id = c.data.id;
  if (c.data.state === "ordering") return h(1, "Chạm vào mèo khách (hoặc phiếu gọi món) để nhận đơn.", { kind: "card", customerId: id });
  if (c.data.state !== "waiting") return h(0, "", null);
  if (!cup) return h(2, "Chạm chồng ly bên trái để lấy ly size M.", { kind: "station", id: "cup_M" });
  if (cup.tea.tea_black < 0.55)
    return h(3, "Nhấn GIỮ bình Trà đen, thả tay khi mức trà chạm vạch nét đứt (60%).", { kind: "station", id: "tea_black" });
  if (liquidTotal(cup) < 0.94) return h(4, "Nhấn GIỮ bình Sữa, thả tay khi chạm vạch xanh (đầy ly).", { kind: "station", id: "milk" });
  if (cup.sugarPumps < 1) return h(5, "Bấm bơm Đường 1 lần (đường 50%).", { kind: "station", id: "sugar" });
  if (cup.iceScoops < 1) return h(6, "Chạm thùng Đá 1 lần (đá 50%).", { kind: "station", id: "ice" });
  if (!cup.toppings.includes("top_boba")) return h(7, "Kéo bát Trân châu thả vào ly (hoặc chạm vào bát).", { kind: "station", id: "top_boba" });
  if (!cup.sealed) return h(8, "Chạm máy Dán nắp để hoàn thiện ly.", { kind: "station", id: "sealer" });
  return h(9, "Kéo ly lên mèo khách (hoặc chạm vào mèo) để giao!", { kind: "customer", customerId: id });
}
