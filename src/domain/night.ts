import type { Rng } from "./customers";
import { canMake, packCost } from "./economy";
import type { Loan, SaveData } from "./types";

/** Daily rent collected every morning from day 2 on. */
export function rentFor(day: number): number {
  return day < 2 ? 0 : 20 + 3 * Math.min(day, 20);
}

export const BANK_FEE = 0.02;

export function depositFee(amount: number): number {
  return amount <= 0 ? 0 : Math.max(1, Math.ceil(amount * BANK_FEE));
}

export function deposit(save: SaveData, amount: number): number {
  const a = Math.floor(Math.max(0, Math.min(amount, save.money)));
  const fee = depositFee(a);
  if (a <= fee) return 0;
  save.money -= a;
  save.bank += a - fee;
  return fee;
}

export function withdraw(save: SaveData, amount: number) {
  const a = Math.floor(Math.max(0, Math.min(amount, save.bank)));
  save.bank -= a;
  save.money += a;
}

/** Robbers never come before this day (the shop needs to be known first). */
export const ROBBERY_FROM_DAY = 4;
export const ROBBERY_BASE = 0.03;

/** Night-time robbery chance: rare, higher with lots of cash left in the shop, lowered by the camera. */
export function robberyChance(save: SaveData, day: number): number {
  if (day < ROBBERY_FROM_DAY || save.money < 50 || save.lastRobberyDay >= day - 2) return 0;
  const cashLure = Math.min(0.05, save.money / 20000);
  const camera = save.upgrades.includes("camera") ? 0.35 : 1;
  return (ROBBERY_BASE + cashLure) * camera;
}

/** What the robber takes: everything, or 35% if the cash is in the safe. */
export function stolenAmount(save: SaveData): number {
  return save.upgrades.includes("safe") ? Math.floor(save.money * 0.35) : save.money;
}

export interface NightReport {
  day: number;
  deposited: number;
  fee: number;
  robbed: boolean;
  stolen: number;
  rent: number;
  installment: number;
  /** Bills that could not be paid (> 0 = bankrupt). */
  overdue: number;
  loanPaidOff: boolean;
}

/**
 * Resolves the night after `day`: deposit, robbery roll, then the morning bills for `day + 1` (rent and loan
 * installment, paid from cash then savings). Mutates the save; returns what happened for the UI.
 */
export function resolveNight(save: SaveData, day: number, depositAmount: number, rng: Rng): NightReport {
  const before = save.money;
  const fee = deposit(save, depositAmount);
  const deposited = before - save.money;

  let robbed = false;
  let stolen = 0;
  if (rng() < robberyChance(save, day)) {
    robbed = true;
    stolen = stolenAmount(save);
    save.money -= stolen;
    save.lastRobberyDay = day;
    save.stats.robberies++;
  }

  const rent = rentFor(day + 1);
  const installment = save.loan ? Math.min(save.loan.installment, save.loan.remaining) : 0;
  const due = rent + installment;
  const fromCash = Math.min(save.money, due);
  save.money -= fromCash;
  const fromBank = Math.min(save.bank, due - fromCash);
  save.bank -= fromBank;
  const paid = fromCash + fromBank;
  const overdue = due - paid;

  let loanPaidOff = false;
  if (save.loan) {
    const paidToLoan = Math.max(0, paid - rent);
    save.loan.remaining -= paidToLoan;
    if (save.loan.remaining <= 0) {
      save.loan = null;
      loanPaidOff = true;
    }
  }
  save.overdue = overdue;
  return { day, deposited, fee, robbed, stolen, rent, installment, overdue, loanPaidOff };
}

/** Bankrupt: bills are overdue, or there is no money left to run the shop at all. */
export function isBankrupt(save: SaveData): boolean {
  if (save.overdue > 0) return true;
  const restock = packCost("cup") + packCost("lid") + packCost("tea_green");
  return save.money + save.bank < restock && !save.unlockedRecipes.some((id) => canMake(save, id));
}

export const LOAN_INTEREST = 0.25;
export const LOAN_DAYS = 8;
/** Fresh capital on top of the overdue bills so the shop can restock. */
export const LOAN_CAPITAL = 300;

export function loanOffer(save: SaveData): { amount: number; total: number; installment: number } {
  const amount = save.overdue + LOAN_CAPITAL;
  const total = Math.ceil(amount * (1 + LOAN_INTEREST)) + (save.loan?.remaining ?? 0);
  return { amount, total, installment: Math.ceil(total / LOAN_DAYS) };
}

/** Takes the emergency bank loan: pays overdue bills, adds capital and merges any existing loan. */
export function takeLoan(save: SaveData): Loan {
  const offer = loanOffer(save);
  save.money += offer.amount - save.overdue;
  save.overdue = 0;
  save.loan = { remaining: offer.total, installment: offer.installment };
  return save.loan;
}

/** Pays the loan off early from cash (no penalty). */
export function repayLoan(save: SaveData, amount: number): number {
  if (!save.loan) return 0;
  const a = Math.floor(Math.max(0, Math.min(amount, save.money, save.loan.remaining)));
  save.money -= a;
  save.loan.remaining -= a;
  if (save.loan.remaining <= 0) save.loan = null;
  return a;
}
