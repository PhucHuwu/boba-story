import { migrate } from "@/game/core/save";
import { clientIp, getRedis, rateLimit } from "@/lib/server/redis";

const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const TTL_SEC = 60 * 60 * 24 * 180;
const MAX_BYTES = 32_000;

const key = (code: string) => `save:${code}`;

function unavailable() {
  return Response.json({ error: "Cloud save chưa được cấu hình" }, { status: 503 });
}

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.toUpperCase() ?? "";
  if (!CODE_RE.test(code)) return Response.json({ error: "Mã khôi phục không hợp lệ" }, { status: 400 });
  const redis = getRedis();
  if (!redis) return unavailable();
  if (!(await rateLimit(`load:${clientIp(req)}`, 30, 60))) return Response.json({ error: "Thử lại sau ít phút" }, { status: 429 });
  const save = await redis.get(key(code));
  if (!save) return Response.json({ error: "Không tìm thấy bản lưu" }, { status: 404 });
  return Response.json({ save }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const redis = getRedis();
  if (!redis) return unavailable();
  if (!(await rateLimit(`save:${clientIp(req)}`, 20, 60))) return Response.json({ error: "Lưu quá nhanh, thử lại sau" }, { status: 429 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "Dữ liệu quá lớn" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }
  const { code, save } = (body ?? {}) as { code?: unknown; save?: unknown };
  if (typeof code !== "string" || !CODE_RE.test(code)) return Response.json({ error: "Mã khôi phục không hợp lệ" }, { status: 400 });
  const clean = migrate(save);
  if (!clean) return Response.json({ error: "Bản lưu không hợp lệ" }, { status: 400 });
  clean.updatedAt = Date.now();
  await redis.set(key(code), clean, { ex: TTL_SEC });
  return Response.json({ ok: true, updatedAt: clean.updatedAt });
}
