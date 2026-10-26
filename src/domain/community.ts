/**
 * Player feedback, anonymous end-of-day telemetry and the menu announcement.
 * Pure shapes and validation shared by the game client, the game server and the admin API.
 */

export const FEEDBACK_CATEGORIES = ["bug", "idea", "difficulty", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_LABEL: Record<FeedbackCategory, string> = {
  bug: "Lỗi",
  idea: "Ý tưởng",
  difficulty: "Độ khó",
  other: "Khác",
};

export const FEEDBACK_MIN_CHARS = 3;
export const FEEDBACK_MAX_CHARS = 1000;

/** Game state when the player wrote the feedback. */
export interface FeedbackContext {
  day: number;
  money: number;
  reputation: number;
  phase: string;
  screen: string;
}

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  /** Optional 1–5 star rating of the game. */
  rating: number | null;
  context: FeedbackContext;
}

export interface FeedbackEntry extends FeedbackInput {
  id: number;
  createdAt: number;
  handled: boolean;
  /** Filled in by the server, never trusted from the client. */
  userAgent: string;
  version: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : min);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function parseFeedback(raw: unknown): FeedbackInput | null {
  if (!isObj(raw)) return null;
  const category = FEEDBACK_CATEGORIES.find((c) => c === raw.category);
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (!category || message.length < FEEDBACK_MIN_CHARS || message.length > FEEDBACK_MAX_CHARS) return null;
  const rating = typeof raw.rating === "number" && Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null;
  const c = isObj(raw.context) ? raw.context : {};
  return {
    category,
    message,
    rating,
    context: {
      day: int(c.day, 0, 9999),
      money: int(c.money, 0, 1e7),
      reputation: int(c.reputation, 0, 100),
      phase: str(c.phase, 16),
      screen: str(c.screen, 16),
    },
  };
}

/** Anonymous summary of one finished game day. */
export interface DayTelemetry {
  day: number;
  served: number;
  lost: number;
  avgQuality: number;
  perfect: number;
  profit: number;
  money: number;
  reputation: number;
  goalMet: boolean;
  relaxed: boolean;
}

export function parseTelemetry(raw: unknown): DayTelemetry | null {
  if (!isObj(raw) || typeof raw.day !== "number" || raw.day < 1) return null;
  return {
    day: int(raw.day, 1, 9999),
    served: int(raw.served, 0, 500),
    lost: int(raw.lost, 0, 500),
    avgQuality: int(raw.avgQuality, 0, 100),
    perfect: int(raw.perfect, 0, 500),
    profit: int(raw.profit, -1e6, 1e6),
    money: int(raw.money, 0, 1e7),
    reputation: int(raw.reputation, 0, 100),
    goalMet: raw.goalMet === true,
    relaxed: raw.relaxed === true,
  };
}

/** Aggregated telemetry for one game day number, across all players. */
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
  /** Reports received per calendar date (UTC, YYYY-MM-DD), newest first. */
  daily: { date: string; reports: number }[];
}

export const ANNOUNCEMENT_TONES = ["info", "event", "warning"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];
export const ANNOUNCEMENT_MAX_CHARS = 280;

export interface Announcement {
  text: string;
  tone: AnnouncementTone;
  createdAt: number;
  /** Epoch ms after which the menu stops showing it; null = until removed. */
  expiresAt: number | null;
}

export function parseAnnouncementDraft(raw: unknown, now: number): Announcement | null {
  if (!isObj(raw)) return null;
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text || text.length > ANNOUNCEMENT_MAX_CHARS) return null;
  const tone = ANNOUNCEMENT_TONES.find((t) => t === raw.tone) ?? "info";
  const hours = typeof raw.hours === "number" && raw.hours > 0 ? Math.min(raw.hours, 24 * 90) : null;
  return { text, tone, createdAt: now, expiresAt: hours ? now + hours * 3600_000 : null };
}

export const isAnnouncementLive = (a: Announcement | null, now: number): a is Announcement => !!a && (a.expiresAt === null || a.expiresAt > now);
