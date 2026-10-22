import { INGREDIENTS, LEVEL_UNITS, RECIPE_BY_ID } from "@/domain/catalog";
import type { CupState, Order } from "@/domain/types";

export interface TicketView {
  title: string;
  lines: string;
}

/** Order ticket checklist shown on the worktop. Pure: easy to test, the scene only renders it. */
export function presentTicket(phase: string, order: Order | undefined, cup: CupState | null): TicketView {
  if (!order) {
    return phase === "open"
      ? { title: "Chưa chọn đơn", lines: "Chạm vào mèo khách hoặc phiếu gọi món để chọn đơn cần làm." }
      : { title: "Chuẩn bị mở cửa", lines: "Kiểm tra kho và công thức, rồi bấm “Mở cửa”." };
  }
  const r = RECIPE_BY_ID[order.recipeId];
  const check = (done: boolean) => (done ? "✓" : "○");
  const parts = [
    `${check(!!cup && cup.size === order.size)} Ly ${order.size}`,
    `${check(!!cup && cup.tea[r.tea] >= r.teaRatio - 0.08)} ${INGREDIENTS[r.tea].name} ${Math.round(r.teaRatio * 100)}%`,
    r.milkRatio > 0 ? `${check(!!cup && cup.milk >= r.milkRatio - 0.08)} Sữa ${Math.round(r.milkRatio * 100)}%` : "Không sữa",
    `${check(!!cup && cup.sugarPumps === LEVEL_UNITS[order.sugar])} Đường ${order.sugar}% (${LEVEL_UNITS[order.sugar]} bơm)`,
    `${check(!!cup && cup.iceScoops === LEVEL_UNITS[order.ice])} Đá ${order.ice}% (${LEVEL_UNITS[order.ice]} muỗng)`,
    r.topping ? `${check(!!cup && cup.toppings.includes(r.topping))} ${INGREDIENTS[r.topping].name}` : "Không topping",
    `${check(!!cup?.sealed)} Dán nắp`,
  ];
  return { title: `Đơn #${order.id}: ${r.name}`, lines: parts.join("   ") };
}
