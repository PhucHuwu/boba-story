import { INGREDIENTS } from "@/domain/catalog";
import type { IngredientId } from "@/domain/types";

export function rejectionMessage(reason: "sealed" | "empty_stock" | "full" | "limit", stock: string): string {
  const name = INGREDIENTS[stock as IngredientId]?.name ?? "nguyên liệu";
  switch (reason) {
    case "sealed":
      return "Ly đã dán nắp — hãy giao cho khách hoặc bỏ ly";
    case "empty_stock":
      return `Hết ${name} — hãy nhập thêm hoặc chọn đơn khác`;
    case "full":
      return "Ly đã đầy rồi!";
    case "limit":
      return "Đã đạt mức tối đa cho ly này";
  }
}
