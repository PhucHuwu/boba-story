import { pick, type Rng } from "./customers";
import type { DayGoal, DayPlan, DayStats, GoalKind, Level, RivalEventId, SaveData, WeatherId } from "./types";

export interface WeatherDef {
  id: WeatherId;
  name: string;
  icon: string;
  description: string;
  /** Multiplier on time between arrivals (< 1 = busier). */
  spawnMul: number;
  tipMul: number;
  /** Multiplier on patience loss. */
  decayMul: number;
  /** Ice levels customers pick from today. */
  ice: Level[];
}

export const WEATHER: Record<WeatherId, WeatherDef> = {
  sunny: { id: "sunny", name: "Nắng đẹp", icon: "☀️", description: "Một ngày dễ chịu.", spawnMul: 1, tipMul: 1, decayMul: 1, ice: [50, 100, 100, 0] },
  hot: {
    id: "hot",
    name: "Nắng nóng",
    icon: "🥵",
    description: "Đông khách, ai cũng muốn nhiều đá và hơi cáu.",
    spawnMul: 0.82,
    tipMul: 1,
    decayMul: 1.2,
    ice: [100, 100, 100, 50],
  },
  rainy: {
    id: "rainy",
    name: "Mưa rả rích",
    icon: "🌧️",
    description: "Vắng khách, ít đá, nhưng ai ghé cũng tip hậu.",
    spawnMul: 1.35,
    tipMul: 1.4,
    decayMul: 0.85,
    ice: [0, 0, 50, 50],
  },
  cloudy: { id: "cloudy", name: "Âm u", icon: "☁️", description: "Khách thong thả, kiên nhẫn hơn.", spawnMul: 1.05, tipMul: 1, decayMul: 0.85, ice: [50, 50, 100, 0] },
  festival: {
    id: "festival",
    name: "Lễ hội phố mèo",
    icon: "🏮",
    description: "Cuối tuần! Rất đông khách, tip cao, ai cũng vội.",
    spawnMul: 0.68,
    tipMul: 1.25,
    decayMul: 1.25,
    ice: [50, 100, 100, 0],
  },
};

export const GOAL_TEXT: Record<GoalKind, (t: number) => string> = {
  served: (t) => `Phục vụ ${t} mèo khách`,
  perfect: (t) => `Pha ${t} ly hoàn hảo`,
  noLost: () => "Không để mèo nào bỏ về (tối thiểu 4 khách)",
  avgStars: (t) => `Đánh giá trung bình từ ${t}★ (tối thiểu 3 đánh giá)`,
  combo: (t) => `Đạt chuỗi combo ${t} ly ngon liên tiếp`,
};

/** The day before the rival may show up, and the base chance per day after that. */
export const RIVAL_FROM_DAY = 3;
export const RIVAL_BASE_CHANCE = 0.3;
const RIVALS: RivalEventId[] = ["discount", "trash", "fakeReviews", "powerCut", "karaoke"];

function pickWeather(day: number, rng: Rng): WeatherId {
  if (day % 7 === 0) return "festival";
  if (day <= 2) return "sunny";
  const r = rng();
  return r < 0.4 ? "sunny" : r < 0.62 ? "hot" : r < 0.82 ? "rainy" : "cloudy";
}

function pickGoal(day: number, rng: Rng): DayGoal {
  const kinds: GoalKind[] = day <= 2 ? ["served", "served", "perfect"] : ["served", "perfect", "noLost", "avgStars", "combo"];
  const kind = pick(rng, kinds);
  const lvl = Math.min(day, 20);
  switch (kind) {
    case "served":
      return { kind, target: Math.min(18, 5 + Math.floor(lvl * 0.6)), reward: 40 + lvl * 5 };
    case "perfect":
      return { kind, target: Math.min(8, 1 + Math.floor(lvl / 3)), reward: 50 + lvl * 5 };
    case "noLost":
      return { kind, target: 0, reward: 70 + lvl * 5 };
    case "avgStars":
      return { kind, target: lvl < 8 ? 4 : 4.5, reward: 60 + lvl * 6 };
    case "combo":
      return { kind, target: Math.min(8, 3 + Math.floor(lvl / 4)), reward: 60 + lvl * 5 };
  }
}

/**
 * Decides weather, goal and a possible rival attack for `save.day`. The more famous the shop, the more
 * the rival gets jealous. Never on the tutorial day.
 */
export function planDay(save: SaveData, rng: Rng, rating: number | null): DayPlan {
  const day = save.day;
  const weather = pickWeather(day, rng);
  const goal = pickGoal(day, rng);
  const jealousy = rating !== null && rating >= 4 ? 0.15 : 0;
  const rival = save.tutorialDone && day >= RIVAL_FROM_DAY && rng() < RIVAL_BASE_CHANCE + jealousy ? pick(rng, RIVALS) : null;
  return { day, weather, goal, rival, rivalAt: 0.22 + rng() * 0.45 };
}

export interface GoalStatus {
  value: number;
  met: boolean;
  label: string;
}

export function goalStatus(goal: DayGoal, st: DayStats): GoalStatus {
  const label = GOAL_TEXT[goal.kind](goal.target);
  switch (goal.kind) {
    case "served":
      return { label, value: st.served, met: st.served >= goal.target };
    case "perfect":
      return { label, value: st.perfect, met: st.perfect >= goal.target };
    case "noLost":
      return { label, value: st.lost, met: st.lost === 0 && st.served >= 4 };
    case "avgStars": {
      const avg = st.reviews ? st.starsSum / st.reviews : 0;
      return { label, value: Math.round(avg * 10) / 10, met: st.reviews >= 3 && avg >= goal.target };
    }
    case "combo":
      return { label, value: st.bestCombo, met: st.bestCombo >= goal.target };
  }
}

/** Combo: consecutive good drinks raise the tip; a bad drink or a lost customer resets it. */
export const COMBO_QUALITY = 75;
export function comboTipBonus(combo: number): number {
  return combo < 2 ? 0 : Math.min(0.6, (combo - 1) * 0.1);
}

/** Food critics appear from day 3: their reviews weigh triple. */
export const CRITIC_FROM_DAY = 3;
export const CRITIC_CHANCE = 0.07;
