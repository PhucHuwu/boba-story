import type { Order, ShipperBrand } from "./types";

/** Delivery-app shippers start showing up once the shop is known a little. */
export const SHIPPER_FROM_DAY = 3;
/** Chance that a new arrival is a shipper (at most one at a time). */
export const SHIPPER_CHANCE = 0.15;
/** Share of each cup's price the delivery app keeps. */
export const DELIVERY_COMMISSION = 0.2;

export const SHIPPER_BRANDS: Record<ShipperBrand, { name: string; color: string }> = {
  grab: { name: "Gráp Meow", color: "#2e9e4f" },
  bee: { name: "Bee Mèo", color: "#e0a419" },
  food: { name: "MeoFood", color: "#d9534f" },
};

export interface Delivery {
  brand: ShipperBrand;
  orders: Order[];
  /** Cups already handed over (index of the current order). */
  done: number;
  /** Sum of the quality of the cups handed over (for the single review at the end). */
  qualitySum: number;
}

export function createDelivery(brand: ShipperBrand, orders: Order[]): Delivery {
  return { brand, orders, done: 0, qualitySum: 0 };
}

/** The cup the shipper is waiting for right now. */
export function currentOrder(d: Delivery): Order {
  return d.orders[Math.min(d.done, d.orders.length - 1)];
}

/** Splits a cup's price into what the shop keeps and the app's cut. */
export function splitCommission(price: number): { net: number; commission: number } {
  const commission = Math.round(price * DELIVERY_COMMISSION);
  return { net: price - commission, commission };
}
