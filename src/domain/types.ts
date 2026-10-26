export type TeaId = "tea_black" | "tea_green" | "tea_oolong";
export type ToppingId = "top_boba" | "top_jelly" | "top_pudding";
export type IngredientId = TeaId | ToppingId | "milk" | "sugar" | "ice" | "cup" | "lid";
export type Size = "M" | "L";
/** Sugar / ice level requested by the customer, in percent. */
export type Level = 0 | 50 | 100;
export type ArchetypeId = "student" | "office" | "regular" | "picky" | "shipper" | "granny" | "tiktoker";
export type ShipperBrand = "grab" | "bee" | "food";
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
  fiveStars: number;
  goalsMet: number;
  rivalsBeaten: number;
  robberies: number;
  bestCombo: number;
}

export type WeatherId = "sunny" | "hot" | "rainy" | "cloudy" | "festival";
export type GoalKind = "served" | "perfect" | "noLost" | "avgStars" | "combo";

export interface DayGoal {
  kind: GoalKind;
  target: number;
  reward: number;
}

export type RivalEventId = "discount" | "trash" | "fakeReviews" | "powerCut" | "karaoke";

/** Everything decided for a day before it opens (stored so reloading cannot reroll it). */
export type MorningVisitor = "lottery" | "stray";

export interface DayPlan {
  day: number;
  weather: WeatherId;
  goal: DayGoal;
  rival: RivalEventId | null;
  /** Fraction of the business day (0..1) when the rival strikes. */
  rivalAt: number;
  /** Who drops by the prep screen this morning, and whether the player already dealt with them. */
  visitor: MorningVisitor | null;
  visitorDone: boolean;
}

export interface Review {
  id: number;
  day: number;
  stars: number;
  text: string;
  archetype: ArchetypeId;
  /** Planted by the rival (or by the player answering the rival). */
  fake?: boolean;
  /** Food critic: weighs triple in the shop rating. */
  critic?: boolean;
}

export interface Loan {
  /** Amount still owed. */
  remaining: number;
  /** Deducted every night. */
  installment: number;
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
  /** Savings at the bank: safe from robbers, not spendable until withdrawn. */
  bank: number;
  loan: Loan | null;
  reviews: Review[];
  nextReviewId: number;
  plan: DayPlan | null;
  lastRobberyDay: number;
  /** The day ended but the night (bank, robbery, loan) has not been resolved yet. */
  nightPending: boolean;
  /** Bills (rent, loan installment) the shop could not pay. > 0 means bankrupt: a bank loan is required. */
  overdue: number;
  /** Takings (price + tips) since the last tax collection; taxed every TAX_PERIOD days. */
  taxBase: number;
  /** Day the current lottery ticket is for (drawn when that day closes); 0 = none. */
  lotteryDay: number;
  /** Meals given to the stray kitten; at STRAY_ADOPT it stays as the shop cat. */
  strayFed: number;
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
  starsSum: number;
  reviews: number;
  bestCombo: number;
  comboBonus: number;
  /** Money spent on rival-event choices, bank fees and loan installments. */
  otherCosts: number;
  goalMet: boolean;
  goalReward: number;
  rivalOutcome: string | null;
  /** Cups handed to delivery-app shippers and the app commission on them. */
  deliveries: number;
  commission: number;
}
