export type TeaId = "tea_black" | "tea_green" | "tea_oolong";
export type ToppingId = "top_boba" | "top_jelly" | "top_pudding";
export type IngredientId = TeaId | ToppingId | "milk" | "sugar" | "ice" | "cup" | "lid";
export type Size = "M" | "L";
/** Sugar / ice level requested by the customer, in percent. */
export type Level = 0 | 50 | 100;
export type ArchetypeId = "student" | "office" | "regular" | "picky";
export type Mood = "idle" | "happy" | "sad" | "impatient";

export interface Recipe {
  id: string;
  name: string;
  tea: TeaId;
  /** Share of the liquid that is tea (0..1). teaRatio + milkRatio = 1. */
  teaRatio: number;
  milkRatio: number;
  topping: ToppingId | null;
  price: number;
  unlockCost: number;
  description: string;
}

export interface Order {
  id: number;
  recipeId: string;
  size: Size;
  sugar: Level;
  ice: Level;
}

/** The drink currently being prepared. Amounts are fractions of the cup volume (0..1+). */
export interface CupState {
  size: Size;
  tea: Record<TeaId, number>;
  milk: number;
  sugarPumps: number;
  iceScoops: number;
  toppings: ToppingId[];
  sealed: boolean;
  overflow: boolean;
  /** Ingredients already deducted from inventory for this cup (deduct exactly once). */
  charged: IngredientId[];
}

export interface QualityResult {
  quality: number;
  recipeAccuracy: number;
  orderMatch: number;
  process: number;
  speed: number;
  wrongDrink: boolean;
  notes: string[];
}

export interface QuestProgress {
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface Settings {
  music: number;
  sfx: number;
  reducedMotion: boolean;
  relaxed: boolean;
  hints: boolean;
}

export interface Stats {
  served: number;
  perfect: number;
  totalEarned: number;
  regularVisits: number;
  pickyHappy: number;
  daysCompleted: number;
}

export interface SaveData {
  version: number;
  day: number;
  money: number;
  reputation: number;
  inventory: Record<IngredientId, number>;
  unlockedRecipes: string[];
  upgrades: string[];
  quests: Record<string, QuestProgress>;
  stats: Stats;
  settings: Settings;
  tutorialDone: boolean;
  regularStage: number;
  updatedAt: number;
}

export type DayPhase = "prep" | "open" | "summary";

export interface DayStats {
  revenue: number;
  tips: number;
  rewards: number;
  spent: number;
  served: number;
  lost: number;
  qualitySum: number;
  perfect: number;
  recipesServed: string[];
  ingredientValueUsed: number;
}
