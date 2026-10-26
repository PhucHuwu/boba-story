import type { ArchetypeId, IngredientId, Level, Recipe, SaveData, TeaId, ToppingId } from "./types";

export const SAVE_VERSION = 3;

export const TEA_IDS: TeaId[] = ["tea_black", "tea_green", "tea_oolong"];
export const TOPPING_IDS: ToppingId[] = ["top_boba", "top_jelly", "top_pudding"];

export interface IngredientDef {
  id: IngredientId;
  name: string;
  /** Cost of one unit (one use in one cup). */
  unitCost: number;
  /** Units per purchase pack. */
  pack: number;
  color: number;
}

export const INGREDIENTS: Record<IngredientId, IngredientDef> = {
  cup: { id: "cup", name: "Ly nhựa", unitCost: 1, pack: 10, color: 0xdfeef5 },
  lid: { id: "lid", name: "Màng dán nắp", unitCost: 1, pack: 10, color: 0xf6c1d0 },
  tea_black: { id: "tea_black", name: "Trà đen", unitCost: 3, pack: 10, color: 0x8a3f22 },
  tea_green: { id: "tea_green", name: "Trà xanh nhài", unitCost: 3, pack: 10, color: 0xb6c95a },
  tea_oolong: { id: "tea_oolong", name: "Trà ô long", unitCost: 4, pack: 10, color: 0xc98a2b },
  milk: { id: "milk", name: "Sữa tươi", unitCost: 3, pack: 10, color: 0xfff8ec },
  sugar: { id: "sugar", name: "Siro đường nâu", unitCost: 1, pack: 10, color: 0xc77a2c },
  ice: { id: "ice", name: "Đá viên", unitCost: 1, pack: 10, color: 0xe6f6ff },
  top_boba: { id: "top_boba", name: "Trân châu", unitCost: 3, pack: 10, color: 0x3a2318 },
  top_jelly: { id: "top_jelly", name: "Thạch dừa", unitCost: 3, pack: 10, color: 0x8fcf6b },
  top_pudding: { id: "top_pudding", name: "Pudding trứng", unitCost: 4, pack: 10, color: 0xf3c64f },
};

export const INVENTORY_CAP = 60;

export const RECIPES: Recipe[] = [
  {
    id: "classic",
    name: "Trà sữa truyền thống",
    tea: "tea_black",
    teaRatio: 0.6,
    milkRatio: 0.4,
    topping: null,
    price: 25,
    unlockCost: 0,
    description: "Trà đen đậm vị pha cùng sữa tươi. Rót trà đến vạch 60% rồi thêm sữa đầy ly.",
  },
  {
    id: "boba",
    name: "Trà sữa trân châu",
    tea: "tea_black",
    teaRatio: 0.6,
    milkRatio: 0.4,
    topping: "top_boba",
    price: 32,
    unlockCost: 0,
    description: "Món tủ của quán: trà sữa truyền thống thêm trân châu đường đen.",
  },
  {
    id: "jasmine",
    name: "Trà xanh nhài",
    tea: "tea_green",
    teaRatio: 1,
    milkRatio: 0,
    topping: null,
    price: 22,
    unlockCost: 0,
    description: "Trà xanh thơm hương nhài, rót đầy ly và không thêm sữa.",
  },
  {
    id: "oolong_milk",
    name: "Ô long sữa",
    tea: "tea_oolong",
    teaRatio: 0.7,
    milkRatio: 0.3,
    topping: null,
    price: 28,
    unlockCost: 100,
    description: "Ô long rang thơm, 70% trà và 30% sữa.",
  },
  {
    id: "green_jelly",
    name: "Trà xanh sữa thạch dừa",
    tea: "tea_green",
    teaRatio: 0.5,
    milkRatio: 0.5,
    topping: "top_jelly",
    price: 30,
    unlockCost: 120,
    description: "Nửa trà xanh, nửa sữa, thêm thạch dừa giòn mát.",
  },
  {
    id: "oolong_pudding",
    name: "Ô long pudding trứng",
    tea: "tea_oolong",
    teaRatio: 0.6,
    milkRatio: 0.4,
    topping: "top_pudding",
    price: 36,
    unlockCost: 180,
    description: "Ô long sữa béo nhẹ kèm pudding trứng mềm mịn.",
  },
  {
    id: "black_jelly",
    name: "Hồng trà thạch dừa",
    tea: "tea_black",
    teaRatio: 1,
    milkRatio: 0,
    topping: "top_jelly",
    price: 26,
    unlockCost: 150,
    description: "Hồng trà nguyên chất rót đầy ly, thêm thạch dừa.",
  },
];

export const RECIPE_BY_ID: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const SIZE_PRICE_BONUS = { M: 0, L: 6 } as const;
/** Pumps / scoops for a requested level. */
export const LEVEL_UNITS: Record<Level, number> = { 0: 0, 50: 1, 100: 2 };

export interface UpgradeDef {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: "fast_tap", name: "Vòi trà tốc độ cao", cost: 300, description: "Rót trà và sữa nhanh hơn 40%." },
  { id: "auto_sealer", name: "Máy dán nắp tự động", cost: 200, description: "Dán nắp gần như tức thì." },
  { id: "wide_counter", name: "Quầy rộng", cost: 350, description: "Thêm chỗ đứng cho mèo khách thứ 4." },
  { id: "cozy_plants", name: "Cây xanh & đèn lồng", cost: 120, description: "Không gian dễ chịu: mèo khách kiên nhẫn hơn 15%." },
  { id: "bell", name: "Chuông gió mèo thần tài", cost: 150, description: "Tiền tip tăng 25% và danh tiếng tăng nhanh hơn." },
  { id: "camera", name: "Camera an ninh", cost: 220, description: "Trộm ngại vào quán: giảm 65% khả năng bị đột nhập ban đêm." },
  { id: "safe", name: "Két sắt chống trộm", cost: 280, description: "Nếu bị trộm, kẻ gian chỉ lấy được 35% tiền mặt." },
];

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  /** Patience lost per second (patience is 0..100). */
  decay: number;
  /** Recipe accuracy tolerance multiplier (lower = stricter). */
  tolerance: number;
  tipMul: number;
  minReputation: number;
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeDef> = {
  student: { id: "student", name: "Mèo học sinh", decay: 100 / 75, tolerance: 1.1, tipMul: 0.8, minReputation: 0 },
  office: { id: "office", name: "Mèo văn phòng", decay: 100 / 48, tolerance: 1, tipMul: 1.2, minReputation: 0 },
  regular: { id: "regular", name: "Mèo Mochi (khách quen)", decay: 100 / 90, tolerance: 1, tipMul: 1.3, minReputation: 0 },
  picky: { id: "picky", name: "Mèo tiểu thư khó tính", decay: 100 / 65, tolerance: 0.6, tipMul: 2, minReputation: 25 },
  shipper: { id: "shipper", name: "Mèo shipper", decay: 100 / 110, tolerance: 1.1, tipMul: 0, minReputation: 0 },
  granny: { id: "granny", name: "Bà cụ hàng xóm", decay: 100 / 160, tolerance: 1.3, tipMul: 0.5, minReputation: 0 },
  tiktoker: { id: "tiktoker", name: "Mèo TikToker", decay: 100 / 45, tolerance: 0.8, tipMul: 1.5, minReputation: 0 },
};

export const REGULAR_FAVORITE = "boba";

/** Short story beats for the regular customer, one per visit. */
export const REGULAR_LINES = [
  "Chào chủ quán mới! Tớ là Mochi, ở ngay góc phố. Cho tớ thử ly trân châu nhé?",
  "Lại là tớ đây! Hôm qua uống ngon quá nên tớ kể cho cả lớp vẽ nghe luôn.",
  "Hôm nay tớ vẽ xong bức tranh quán mình đó. Như cũ nha, nhiều trân châu vào!",
  "Tớ treo tranh ở tiệm bánh bên cạnh rồi, ai cũng hỏi quán trà sữa này ở đâu~",
  "Quán ngày càng đông ghê! Tớ vui vì được là khách quen đầu tiên của cậu.",
];

export const FALLBACK_LINES: Record<ArchetypeId, string[]> = {
  student: ["Meo! Cho tớ một ly nha, chiều nay còn học thêm!", "Nghe nói topping ở đây ngon lắm!", "Tớ để dành tiền tiêu vặt cả tuần đó~"],
  office: ["Làm nhanh giúp tôi nhé, sắp họp rồi.", "Một ly để tỉnh táo cả buổi chiều.", "Deadline dí quá, cần trà sữa gấp!"],
  regular: REGULAR_LINES,
  picky: ["Hy vọng lần này đúng công thức nhé.", "Ta rất kỹ tính về tỷ lệ trà và sữa đấy.", "Đừng làm ta thất vọng, chủ quán nhỏ."],
  shipper: ["Đơn app nè chủ quán, làm giúp em mấy ly nha!", "Khách đặt qua app, em chờ lấy hàng nhé.", "Shipper tới lấy đơn đây, meo!"],
  granny: ["Bà ở ngay đầu hẻm nè con. Làm cho bà ly ít ngọt nha.", "Chậm chậm thôi con, bà không vội đâu.", "Hồi trẻ bà cũng mở quán nước đó, con làm đi bà coi."],
  tiktoker: ["Hello cả nhà! Hôm nay mình review quán trà sữa mèo nè!", "Đang live nha chủ quán, làm ly nào thật xịn!", "Quán này có lên xu hướng được không ta? Làm đi mình quay!"],
};

export interface QuestDef {
  id: string;
  title: string;
  target: number;
  reward: number;
  metric:
    | "served"
    | "perfect"
    | "totalEarned"
    | "recipes"
    | "upgrades"
    | "regularVisits"
    | "pickyHappy"
    | "daysCompleted"
    | "reputation"
    | "fiveStars"
    | "goalsMet"
    | "rivalsBeaten"
    | "bestCombo";
}

export const QUESTS: QuestDef[] = [
  { id: "q_serve3", title: "Phục vụ 3 mèo khách", target: 3, reward: 40, metric: "served" },
  { id: "q_perfect1", title: "Pha 1 ly hoàn hảo (≥ 90 điểm)", target: 1, reward: 50, metric: "perfect" },
  { id: "q_earn200", title: "Kiếm tổng cộng 200 xu", target: 200, reward: 60, metric: "totalEarned" },
  { id: "q_day1", title: "Hoàn thành ngày đầu tiên", target: 1, reward: 50, metric: "daysCompleted" },
  { id: "q_recipe1", title: "Mở khóa 1 công thức mới", target: 4, reward: 50, metric: "recipes" },
  { id: "q_upgrade1", title: "Mua nâng cấp đầu tiên", target: 1, reward: 80, metric: "upgrades" },
  { id: "q_regular3", title: "Phục vụ Mochi 3 lần", target: 3, reward: 100, metric: "regularVisits" },
  { id: "q_picky2", title: "Làm mèo tiểu thư hài lòng 2 lần", target: 2, reward: 120, metric: "pickyHappy" },
  { id: "q_perfect10", title: "Pha 10 ly hoàn hảo", target: 10, reward: 150, metric: "perfect" },
  { id: "q_serve40", title: "Phục vụ 40 mèo khách", target: 40, reward: 200, metric: "served" },
  { id: "q_rep50", title: "Đạt 50 danh tiếng", target: 50, reward: 250, metric: "reputation" },
  { id: "q_days5", title: "Kinh doanh trọn 5 ngày", target: 5, reward: 200, metric: "daysCompleted" },
  { id: "q_combo5", title: "Đạt chuỗi combo 5 ly ngon", target: 5, reward: 120, metric: "bestCombo" },
  { id: "q_goal3", title: "Hoàn thành 3 mục tiêu ngày", target: 3, reward: 150, metric: "goalsMet" },
  { id: "q_five15", title: "Nhận 15 đánh giá 5 sao", target: 15, reward: 180, metric: "fiveStars" },
  { id: "q_rival2", title: "Thắng đối thủ 2 lần", target: 2, reward: 200, metric: "rivalsBeaten" },
  { id: "q_days14", title: "Trụ vững 14 ngày", target: 14, reward: 400, metric: "daysCompleted" },
];

export const DAY = {
  /** Real seconds for a full business day (09:00 → 21:00). */
  lengthSec: 240,
  openHour: 9,
  closeHour: 21,
  peaks: [
    [11.5, 13],
    [17, 19],
  ] as [number, number][],
};

export function defaultSave(): SaveData {
  const inventory = Object.fromEntries(Object.keys(INGREDIENTS).map((k) => [k, 0])) as Record<IngredientId, number>;
  Object.assign(inventory, {
    cup: 25,
    lid: 25,
    tea_black: 18,
    tea_green: 10,
    tea_oolong: 0,
    milk: 18,
    sugar: 20,
    ice: 25,
    top_boba: 12,
    top_jelly: 0,
    top_pudding: 0,
  });
  return {
    version: SAVE_VERSION,
    day: 1,
    money: 500,
    reputation: 10,
    inventory,
    unlockedRecipes: RECIPES.filter((r) => r.unlockCost === 0).map((r) => r.id),
    upgrades: [],
    quests: Object.fromEntries(QUESTS.map((q) => [q.id, { progress: 0, done: false, claimed: false }])),
    stats: { served: 0, perfect: 0, totalEarned: 0, regularVisits: 0, pickyHappy: 0, daysCompleted: 0, fiveStars: 0, goalsMet: 0, rivalsBeaten: 0, robberies: 0, bestCombo: 0 },
    settings: { music: 0.5, sfx: 0.8, reducedMotion: false, relaxed: false, hints: true },
    tutorialDone: false,
    regularStage: 0,
    bank: 0,
    loan: null,
    reviews: [],
    nextReviewId: 1,
    plan: null,
    lastRobberyDay: 0,
    nightPending: false,
    overdue: 0,
    taxBase: 0,
    updatedAt: Date.now(),
  };
}
