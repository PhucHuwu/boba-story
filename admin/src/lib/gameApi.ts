import "server-only";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Calls the game's `/api/admin/*` endpoints server-to-server with the shared admin key. */
export async function gameApi<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const base = process.env.GAME_API_URL?.replace(/\/$/, "");
  const key = process.env.ADMIN_API_KEY;
  if (!base || !key) return { ok: false, status: 503, error: "Thiếu cấu hình GAME_API_URL hoặc ADMIN_API_KEY" };
  try {
    const res = await fetch(`${base}/api/admin${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${key}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, status: res.status, error: json.error ?? `Lỗi máy chủ game (${res.status})` };
    return { ok: true, data: json };
  } catch {
    return { ok: false, status: 502, error: "Không kết nối được máy chủ game" };
  }
}
