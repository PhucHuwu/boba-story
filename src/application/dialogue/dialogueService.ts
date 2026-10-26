import { ARCHETYPES, FALLBACK_LINES, RECIPE_BY_ID, REGULAR_LINES } from "@/domain/catalog";
import type { ArchetypeId } from "@/domain/types";
import type { DialogueEvent, RateLimiter, Rng, TextCache, TextGenerator } from "../ports";

const PERSONAS: Record<ArchetypeId, string> = {
  student: "một bạn mèo học sinh tinh nghịch, năng động, mê topping và món mới",
  office: "một anh mèo nhân viên văn phòng bận rộn, lịch sự nhưng hay vội",
  regular: "Mochi, cô mèo tam thể khách quen, họa sĩ, thân thiện và ấm áp",
  picky: "một quý cô mèo Ba Tư sang chảnh, khó tính, rất để ý công thức",
  shipper: "một bạn mèo shipper giao đồ ăn qua app, nhanh nhẹn, lễ phép, đang chờ lấy đơn nhiều ly",
  granny: "một bà cụ mèo hàng xóm hiền hậu, nói chậm rãi, xưng bà gọi chủ quán là con",
  tiktoker: "một bạn mèo TikToker trẻ trung, đang quay video review, nói kiểu mạng xã hội, hơi sốt ruột",
};

export const DIALOGUE_EVENTS: readonly DialogueEvent[] = ["order", "happy", "sad", "leave", "review"];

const EVENT_TASK: Record<DialogueEvent, string> = {
  order: "đang gọi món",
  happy: "vừa nhận ly đồ uống rất ngon và cảm ơn chủ quán",
  sad: "vừa nhận ly đồ uống chưa đúng ý và hơi thất vọng (vẫn lịch sự)",
  leave: "chờ quá lâu nên bỏ về",
  review: "đang viết một dòng nhận xét ngắn trên mạng về quán trà sữa",
};

const REVIEW_MOOD: Record<number, string> = {
  1: "rất tệ, cay cú, hài hước kiểu than phiền vô lý (ví dụ nhân viên không cười, giọng chói)",
  2: "khá thất vọng, hơi mỉa mai",
  3: "bình thường, nửa khen nửa chê",
  4: "khá hài lòng, có một điểm chê nhỏ",
  5: "cực kỳ hài lòng, khen nhiệt tình",
};

const SYSTEM_PROMPT =
  "Bạn viết lời thoại cho game cozy 'Boba Story', nơi mọi khách hàng là mèo nhân hóa đi hai chân. Chỉ trả về đúng MỘT câu thoại tiếng Việt, tối đa 18 từ, dễ thương, an toàn cho mọi lứa tuổi, có thể kèm 'meo'. Không ghi tên nhân vật, không dùng dấu ngoặc kép, không emoji.";

/** Number of cached variants per (archetype, event, recipe) so lines don't repeat too often. */
const VARIANTS = 6;
const CACHE_TTL_SEC = 60 * 60 * 24;

export interface DialogueQuery {
  archetype: ArchetypeId;
  event: DialogueEvent;
  recipeId?: string;
  stage: number;
}

export type DialogueSource = "ai" | "cache" | "fallback";

/** Parses an untrusted request body. Returns null when invalid. */
export function parseDialogueQuery(body: unknown): DialogueQuery | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const archetype = b.archetype as ArchetypeId;
  const event = b.event as DialogueEvent;
  if (typeof archetype !== "string" || !(archetype in ARCHETYPES) || !DIALOGUE_EVENTS.includes(event)) return null;
  const recipeId = typeof b.recipeId === "string" && RECIPE_BY_ID[b.recipeId] ? b.recipeId : undefined;
  const stage = typeof b.stage === "number" && Number.isFinite(b.stage) ? Math.max(0, Math.min(10, Math.floor(b.stage))) : 0;
  return { archetype, event, recipeId, stage };
}

export function sanitizeLine(text: string): string {
  return text
    .trim()
    .replace(/^[^:"“]{1,30}:\s*/, "")
    .replace(/^["'“”\s]+|["'“”\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 140);
}

/**
 * Use case: produce one short line for a cat customer.
 * Always returns a usable line; AI output is an optional enhancement over fixed lines.
 */
export class DialogueService {
  constructor(private readonly deps: { generator: TextGenerator | null; cache: TextCache | null; limiter: RateLimiter; rng: Rng }) {}

  fallback(q: DialogueQuery): string {
    if (q.event === "order") {
      if (q.archetype === "regular") return REGULAR_LINES[Math.min(q.stage, REGULAR_LINES.length - 1)];
      const lines = FALLBACK_LINES[q.archetype];
      return lines[Math.floor(this.deps.rng() * lines.length)];
    }
    if (q.event === "happy") return "Ngon quá trời! Cảm ơn chủ quán nha~ meo!";
    if (q.event === "sad") return "Hmm... lần sau làm đúng hơn nhé.";
    if (q.event === "review") return q.stage >= 4 ? "Ngon, sẽ quay lại!" : "Chưa ưng lắm.";
    return "Lâu quá, tớ phải đi đây...";
  }

  async line(q: DialogueQuery, clientId: string): Promise<{ line: string; source: DialogueSource }> {
    const { generator, cache, limiter, rng } = this.deps;
    const base = { line: this.fallback(q), source: "fallback" as const };
    if (!generator || !(await limiter.allow(`dlg:${clientId}`, 40, 60))) return base;

    const variant = q.archetype === "regular" || q.event === "review" ? `${q.stage}-${Math.floor(rng() * VARIANTS)}` : Math.floor(rng() * VARIANTS);
    const key = `dlg:${q.archetype}:${q.event}:${q.recipeId ?? "-"}:${variant}`;
    const cached = await cache?.get(key).catch(() => null);
    if (cached) return { line: cached, source: "cache" };

    const recipe = q.recipeId ? RECIPE_BY_ID[q.recipeId] : undefined;
    const story =
      q.event === "review"
        ? ` Đánh giá ${q.stage} sao: ${REVIEW_MOOD[Math.max(1, Math.min(5, q.stage))]}. Viết như một bình luận Google Maps.`
        : q.archetype === "regular" ? ` Bối cảnh câu chuyện lần ghé thứ ${q.stage + 1}: "${REGULAR_LINES[Math.min(q.stage, REGULAR_LINES.length - 1)]}"` : "";
    const text = await generator.generate(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Nhân vật: ${PERSONAS[q.archetype]}. Tình huống: ${EVENT_TASK[q.event]}${recipe ? ` (món: ${recipe.name})` : ""}.${story}` },
      ],
      { maxTokens: 80, timeoutMs: 6000 },
    );
    const line = text ? sanitizeLine(text) : "";
    if (line.length < 4) return base;
    await cache?.set(key, line, CACHE_TTL_SEC).catch(() => undefined);
    return { line, source: "ai" };
  }
}
