/** Shapes returned by the game's admin API (mirrors src/domain/community.ts in the game). */

export const CATEGORY_LABEL: Record<string, string> = { bug: "Lỗi", idea: "Ý tưởng", difficulty: "Độ khó", other: "Khác" };
export const TONE_LABEL: Record<string, string> = { info: "Thông tin", event: "Sự kiện", warning: "Cảnh báo" };

export interface FeedbackEntry {
  id: number;
  category: string;
  message: string;
  rating: number | null;
  context: { day: number; money: number; reputation: number; phase: string; screen: string };
  createdAt: number;
  handled: boolean;
  userAgent: string;
  version: string;
}

export interface FeedbackList {
  items: FeedbackEntry[];
  total: number;
  open: number;
}

export interface DayAggregate {
  day: number;
  reports: number;
  served: number;
  lost: number;
  qualitySum: number;
  perfect: number;
  profitSum: number;
  losingDays: number;
  moneySum: number;
  reputationSum: number;
  goalsMet: number;
  relaxed: number;
}

export interface TelemetryStats {
  days: DayAggregate[];
  daily: { date: string; reports: number }[];
}

export interface Announcement {
  text: string;
  tone: string;
  createdAt: number;
  expiresAt: number | null;
}

export interface SaveLookup {
  code: string;
  save: Record<string, unknown> & {
    day: number;
    money: number;
    reputation: number;
    bank: number;
    loan: { remaining: number; installment: number } | null;
    overdue: number;
    tutorialDone: boolean;
    unlockedRecipes: string[];
    upgrades: string[];
    decor?: string[];
    inventory: Record<string, number>;
    stats: Record<string, number>;
    settings: Record<string, unknown>;
    updatedAt: number;
  };
  raw: unknown;
}

const dt = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
export const fmtTime = (ms: number) => (ms ? dt.format(new Date(ms)) : "—");
export const fmtNum = (n: number, digits = 0) => n.toLocaleString("vi-VN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
