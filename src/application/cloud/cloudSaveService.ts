import { migrate, normalizeRecoveryCode } from "@/domain/saveSchema";
import type { SaveData } from "@/domain/types";
import type { CloudSaveStore, RateLimiter } from "../ports";

export const CLOUD_SAVE_TTL_SEC = 60 * 60 * 24 * 180;
export const CLOUD_SAVE_MAX_BYTES = 32_000;

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; status: 400 | 404 | 413 | 429 | 503; error: string };

const fail = (status: 400 | 404 | 413 | 429 | 503, error: string) => ({ ok: false as const, status, error });

/** Use cases for anonymous cloud saves keyed by a recovery code. */
export class CloudSaveService {
  constructor(private readonly deps: { store: CloudSaveStore | null; limiter: RateLimiter; now: () => number }) {}

  get available() {
    return this.deps.store !== null;
  }

  async load(rawCode: string, clientId: string): Promise<ServiceResult<SaveData>> {
    const code = normalizeRecoveryCode(rawCode);
    if (!code) return fail(400, "Mã khôi phục không hợp lệ");
    const { store, limiter } = this.deps;
    if (!store) return fail(503, "Cloud save chưa được cấu hình");
    if (!(await limiter.allow(`load:${clientId}`, 30, 60))) return fail(429, "Thử lại sau ít phút");
    const data = migrate(await store.get(code));
    return data ? { ok: true, value: data } : fail(404, "Không tìm thấy bản lưu");
  }

  async store(rawBody: string, clientId: string): Promise<ServiceResult<{ updatedAt: number }>> {
    const { store, limiter, now } = this.deps;
    if (!store) return fail(503, "Cloud save chưa được cấu hình");
    if (!(await limiter.allow(`save:${clientId}`, 20, 60))) return fail(429, "Lưu quá nhanh, thử lại sau");
    if (rawBody.length > CLOUD_SAVE_MAX_BYTES) return fail(413, "Dữ liệu quá lớn");
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(400, "JSON không hợp lệ");
    }
    const { code: rawCode, save } = (body ?? {}) as { code?: unknown; save?: unknown };
    const code = typeof rawCode === "string" ? normalizeRecoveryCode(rawCode) : null;
    if (!code) return fail(400, "Mã khôi phục không hợp lệ");
    const clean = migrate(save);
    if (!clean) return fail(400, "Bản lưu không hợp lệ");
    clean.updatedAt = now();
    await store.put(code, clean, CLOUD_SAVE_TTL_SEC);
    return { ok: true, value: { updatedAt: clean.updatedAt } };
  }
}
