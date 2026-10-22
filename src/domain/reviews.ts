import type { ArchetypeId, Review } from "./types";
import { pick, type Rng } from "./customers";

/** Reviews kept in the save (oldest dropped first). */
export const REVIEW_KEEP = 80;
/** The shop rating is the weighted average of this many latest reviews. */
export const RATING_WINDOW = 30;
/** Chance that an otherwise fine customer leaves a petty, unfair comment. */
export const PETTY_CHANCE = 0.12;

const BY_STARS: Record<1 | 2 | 3 | 4 | 5, string[]> = {
  5: [
    "Trà thơm, trân châu dai, ly đầy đặn. Sẽ quay lại meo!",
    "Ngon xuất sắc! Uống xong muốn lăn ra sưởi nắng luôn.",
    "Chuẩn vị, đúng đường đúng đá. 10 điểm không có nhưng.",
    "Quán xinh, nước ngon, chủ quán dễ thương. Đỉnh!",
    "Lần đầu thấy ly trà sữa cân đối đến vậy. Tôn trọng.",
    "Uống một ngụm mà râu dựng hết lên vì ngon.",
  ],
  4: [
    "Ngon nha, chỉ hơi chờ lâu một xíu thôi.",
    "Vị ổn áp, giá hợp lý. Lần sau thử món khác.",
    "Ly khá chuẩn, trân châu mềm. Cho 4 sao vì tớ khó tính.",
    "Hương trà dễ chịu, ngồi quán thấy thư giãn ghê.",
    "Ngon, nhưng tớ thích nhiều topping hơn tí nữa.",
  ],
  3: [
    "Tạm được. Không dở nhưng cũng không nhớ nổi.",
    "Uống được, nhưng tỷ lệ trà sữa chưa chuẩn lắm.",
    "Bình thường thôi, chắc hôm nay quán đông quá.",
    "Ly hơi lệch vị so với mô tả trên menu.",
  ],
  2: [
    "Hơi thất vọng. Đường đá không đúng như tớ dặn.",
    "Uống được hai ngụm thì bỏ dở. Tiếc tiền tiêu vặt.",
    "Trà nhạt như nước rửa ấm, buồn.",
    "Chờ lâu mà ly ra chưa đúng món. Chán.",
  ],
  1: [
    "Đợi mỏi cả bốn chân mà không ai phục vụ. 1 sao!",
    "Tớ đứng chờ tới mức kịp mọc thêm một sợi râu.",
    "Quán đông mà làm chậm, bỏ về uống nước lã.",
    "Không bao giờ quay lại. Meo. Hết.",
  ],
};

const ARCHETYPE_FLAVOR: Record<ArchetypeId, string[]> = {
  student: ["Hợp túi tiền học sinh!", "Cả lớp sẽ được nghe tớ kể."],
  office: ["Đủ tỉnh táo cho cuộc họp chiều.", "Nhanh gọn, hợp dân văn phòng."],
  regular: ["Mochi luôn ủng hộ quán nè!", "Như mọi khi, cảm giác như nhà."],
  picky: ["Ta đã thử 47 quán trong thành phố.", "Ly nhựa hơi kém sang, nhưng thôi."],
};

/** Unfair / petty comments: these happen even when the drink was good. */
export const PETTY_COMMENTS = [
  "Nhân viên không cười. Trà ngon nhưng tâm hồn tôi lạnh.",
  "Giọng chủ quán chói quá, tai tớ cụp xuống luôn.",
  "Chủ quán nhìn tớ hơi lâu lúc tớ đếm xu. Khó chịu.",
  "Ống hút to quá, hút trân châu bị sặc 3 lần.",
  "Ly ngon nhưng nhạc trong quán không hợp gu tớ.",
  "Đá lạnh quá. Ừ thì đá phải lạnh nhưng mà vẫn lạnh quá.",
  "Màu ly không hợp với bộ lông hôm nay của tớ.",
  "Quán không có chỗ để tớ nằm phơi bụng. Trừ sao.",
  "Chủ quán chào to quá làm tớ giật mình rớt ví.",
  "Tớ gọi trà sữa mà họ đưa trà sữa. Thiếu bất ngờ.",
  "Trân châu tròn quá, tớ thích hình vuông hơn.",
  "Bên kia đường có con chó nhìn tớ suốt lúc uống. Sợ.",
];

const CRITIC_TEXTS: Record<"good" | "bad", string[]> = {
  good: ["[Food reviewer] Một viên ngọc ẩn mình trong phố mèo. Highly recommend!", "[Food reviewer] Cân bằng hoàn hảo giữa trà và sữa. Đáng ghé!"],
  bad: ["[Food reviewer] Kỳ vọng nhiều, nhận về một ly vô hồn.", "[Food reviewer] Không đáng để quay video. Bỏ qua."],
};

export interface ReviewInput {
  /** Quality of the served drink; null when the customer gave up and left. */
  quality: number | null;
  /** Patience left when served (0..100). */
  patience: number;
  archetype: ArchetypeId;
  critic?: boolean;
  rng: Rng;
  /** Extra chance of a specific complaint today (rival trash, loud music...). */
  malus?: { chance: number; texts: string[] } | null;
}

export function starsForQuality(quality: number | null): 1 | 2 | 3 | 4 | 5 {
  if (quality === null) return 1;
  if (quality >= 88) return 5;
  if (quality >= 72) return 4;
  if (quality >= 58) return 3;
  if (quality >= 42) return 2;
  return 1;
}

const clampStars = (s: number) => Math.max(1, Math.min(5, Math.round(s))) as 1 | 2 | 3 | 4 | 5;

/** Builds the star rating and a comment for one customer. Pure: randomness only through `rng`. */
export function writeReview({ quality, patience, archetype, critic = false, rng, malus }: ReviewInput): { stars: number; text: string } {
  let stars: number = starsForQuality(quality);
  if (quality !== null && patience < 25) stars -= 1;
  let text = pick(rng, BY_STARS[clampStars(stars)]);
  if (quality !== null && malus && rng() < malus.chance) {
    stars -= 1;
    text = pick(rng, malus.texts);
  } else if (quality !== null && rng() < PETTY_CHANCE) {
    // Petty reviewers knock a star off even good drinks (but never below 1).
    stars -= stars >= 3 ? 1 : 0;
    text = pick(rng, PETTY_COMMENTS);
  } else if (quality !== null && stars >= 4 && rng() < 0.35) {
    text = `${text} ${pick(rng, ARCHETYPE_FLAVOR[archetype])}`;
  }
  if (critic) text = pick(rng, CRITIC_TEXTS[stars >= 4 ? "good" : "bad"]);
  return { stars: clampStars(stars), text };
}

export function addReview(reviews: Review[], review: Review): Review[] {
  const next = [...reviews, review];
  return next.length > REVIEW_KEEP ? next.slice(next.length - REVIEW_KEEP) : next;
}

/** Weighted average of the latest reviews (critics count triple). Null when there are none yet. */
export function shopRating(reviews: Review[]): number | null {
  const recent = reviews.slice(-RATING_WINDOW);
  if (!recent.length) return null;
  let sum = 0;
  let weight = 0;
  for (const r of recent) {
    const w = r.critic ? 3 : 1;
    sum += r.stars * w;
    weight += w;
  }
  return Math.round((sum / weight) * 10) / 10;
}

/** Multiplier for the time between arrivals: good ratings bring more cats, bad ones fewer. */
export function ratingSpawnFactor(rating: number | null): number {
  if (rating === null) return 1;
  return Math.max(0.75, Math.min(1.45, 1 + (3.6 - rating) * 0.2));
}

export function starDistribution(reviews: Review[]): number[] {
  const d = [0, 0, 0, 0, 0];
  for (const r of reviews) d[r.stars - 1]++;
  return d;
}
