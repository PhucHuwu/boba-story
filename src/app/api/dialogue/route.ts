import { ARCHETYPES, FALLBACK_LINES, RECIPE_BY_ID, REGULAR_LINES } from "@/game/core/data";
import type { ArchetypeId } from "@/game/core/types";
import { chatCompletion } from "@/lib/server/ai";
import { clientIp, getRedis, rateLimit } from "@/lib/server/redis";

const PERSONAS: Record<ArchetypeId, string> = {
  student: "một bạn mèo học sinh tinh nghịch, năng động, mê topping và món mới",
  office: "một anh mèo nhân viên văn phòng bận rộn, lịch sự nhưng hay vội",
  regular: "Mochi, cô mèo tam thể khách quen, họa sĩ, thân thiện và ấm áp",
  picky: "một quý cô mèo Ba Tư sang chảnh, khó tính, rất để ý công thức",
};

const EVENTS = ["order", "happy", "sad", "leave"] as const;
type Event = (typeof EVENTS)[number];

const EVENT_TASK: Record<Event, string> = {
  order: "đang gọi món",
  happy: "vừa nhận ly đồ uống rất ngon và cảm ơn chủ quán",
  sad: "vừa nhận ly đồ uống chưa đúng ý và hơi thất vọng (vẫn lịch sự)",
  leave: "chờ quá lâu nên bỏ về",
};

function fallback(archetype: ArchetypeId, event: Event, stage: number): string {
  if (event === "order") {
    if (archetype === "regular") return REGULAR_LINES[Math.min(stage, REGULAR_LINES.length - 1)];
    const lines = FALLBACK_LINES[archetype];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  if (event === "happy") return "Ngon quá trời! Cảm ơn chủ quán nha~ meo!";
  if (event === "sad") return "Hmm... lần sau làm đúng hơn nhé.";
  return "Lâu quá, tớ phải đi đây...";
}

function sanitize(text: string): string {
  return text
    .replace(/^["'“”\s]+|["'“”\s]+$/g, "")
    .replace(/^[^:]{1,30}:\s*/, "")
    .replace(/\s+/g, " ")
    .slice(0, 140);
}

/**
 * Generates a short Vietnamese line for a cat customer. Always returns a usable line:
 * when the AI proxy is unavailable, slow or rate-limited, a fixed fallback line is used.
 */
export async function POST(req: Request) {
  let body: { archetype?: unknown; event?: unknown; recipeId?: unknown; stage?: unknown; quality?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }
  const archetype = body.archetype as ArchetypeId;
  const event = body.event as Event;
  if (!(archetype in ARCHETYPES) || !EVENTS.includes(event)) return Response.json({ error: "Tham số không hợp lệ" }, { status: 400 });
  const recipe = typeof body.recipeId === "string" ? RECIPE_BY_ID[body.recipeId] : undefined;
  const stage = typeof body.stage === "number" ? Math.max(0, Math.min(10, Math.floor(body.stage))) : 0;
  const base = fallback(archetype, event, stage);

  if (!(await rateLimit(`dlg:${clientIp(req)}`, 40, 60))) return Response.json({ line: base, source: "fallback" });

  const cacheKey = `dlg:${archetype}:${event}:${recipe?.id ?? "-"}:${archetype === "regular" ? stage : Math.floor(Math.random() * 6)}`;
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) return Response.json({ line: cached, source: "cache" });
    } catch {
      /* ignore cache errors */
    }
  }

  const story = archetype === "regular" ? ` Bối cảnh câu chuyện lần ghé thứ ${stage + 1}: "${REGULAR_LINES[Math.min(stage, REGULAR_LINES.length - 1)]}"` : "";
  const text = await chatCompletion(
    [
      {
        role: "system",
        content:
          "Bạn viết lời thoại cho game cozy 'Boba Story', nơi mọi khách hàng là mèo nhân hóa đi hai chân. Chỉ trả về đúng MỘT câu thoại tiếng Việt, tối đa 18 từ, dễ thương, an toàn cho mọi lứa tuổi, có thể kèm 'meo'. Không ghi tên nhân vật, không dùng dấu ngoặc kép, không emoji.",
      },
      {
        role: "user",
        content: `Nhân vật: ${PERSONAS[archetype]}. Tình huống: ${EVENT_TASK[event]}${recipe ? ` (món: ${recipe.name})` : ""}.${story}`,
      },
    ],
    { maxTokens: 80, timeoutMs: 6000 },
  );
  const line = text ? sanitize(text) : "";
  if (!line || line.length < 4) return Response.json({ line: base, source: "fallback" });
  if (redis) {
    try {
      await redis.set(cacheKey, line, { ex: 60 * 60 * 24 });
    } catch {
      /* ignore */
    }
  }
  return Response.json({ line, source: "ai" });
}
