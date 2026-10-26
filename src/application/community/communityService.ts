import {
  FEEDBACK_CATEGORIES,
  isAnnouncementLive,
  parseAnnouncementDraft,
  parseFeedback,
  parseTelemetry,
  type Announcement,
  type FeedbackEntry,
  type TelemetryStats,
} from "@/domain/community";
import { migrate, normalizeRecoveryCode } from "@/domain/saveSchema";
import type { SaveData } from "@/domain/types";
import type { AnnouncementStore, CloudSaveStore, FeedbackQuery, FeedbackStore, RateLimiter, TelemetryStore } from "../ports";
import type { ServiceResult } from "../cloud/cloudSaveService";

export const FEEDBACK_PER_HOUR = 5;
export const TELEMETRY_PER_HOUR = 60;
export const FEEDBACK_SCAN = 1000;
export const STATS_DATES = 30;
export const ADMIN_LOGIN_TRIES = 8;
export const ADMIN_LOGIN_WINDOW_SEC = 15 * 60;

const fail = (status: 400 | 404 | 413 | 429 | 503, error: string) => ({ ok: false as const, status, error });
const ok = <T>(value: T) => ({ ok: true as const, value });
const OFF = "Máy chủ dữ liệu chưa được cấu hình";

export interface CommunityDeps {
  feedback: FeedbackStore | null;
  telemetry: TelemetryStore | null;
  announcement: AnnouncementStore | null;
  saves: CloudSaveStore | null;
  limiter: RateLimiter;
  now: () => number;
  /** Build identifier attached to every feedback entry. */
  version: string;
}

/** UTC calendar date (YYYY-MM-DD) of an epoch-ms timestamp. */
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Public use cases: players send feedback and telemetry and read the announcement. */
export class CommunityService {
  constructor(private readonly deps: CommunityDeps) {}

  async submitFeedback(raw: unknown, clientId: string, userAgent: string): Promise<ServiceResult<{ id: number }>> {
    const input = parseFeedback(raw);
    if (!input) return fail(400, "Nội dung góp ý chưa hợp lệ");
    const { feedback, limiter, now, version } = this.deps;
    if (!feedback) return fail(503, OFF);
    if (!(await limiter.allow(`fb:${clientId}`, FEEDBACK_PER_HOUR, 3600))) return fail(429, "Bạn đã gửi nhiều góp ý, thử lại sau một lúc nhé");
    const entry = await feedback.add({ ...input, createdAt: now(), handled: false, userAgent: userAgent.slice(0, 200), version });
    return ok({ id: entry.id });
  }

  async recordTelemetry(raw: unknown, clientId: string): Promise<ServiceResult<null>> {
    const report = parseTelemetry(raw);
    if (!report) return fail(400, "Dữ liệu không hợp lệ");
    const { telemetry, limiter, now } = this.deps;
    if (!telemetry) return fail(503, OFF);
    if (!(await limiter.allow(`tm:${clientId}`, TELEMETRY_PER_HOUR, 3600))) return fail(429, "Thử lại sau");
    await telemetry.record(report, utcDate(now()));
    return ok(null);
  }

  async currentAnnouncement(): Promise<Announcement | null> {
    const store = this.deps.announcement;
    if (!store) return null;
    const a = await store.get();
    return isAnnouncementLive(a, this.deps.now()) ? a : null;
  }
}

/** Admin use cases. Callers must already be authenticated as the admin. */
export class AdminService {
  constructor(private readonly deps: CommunityDeps) {}

  /** Brute-force guard for the admin login form, keyed by the visitor's IP. */
  async allowLogin(key: string): Promise<ServiceResult<{ allowed: boolean }>> {
    if (!key || key.length > 100) return fail(400, "Thiếu khoá");
    return ok({ allowed: await this.deps.limiter.allow(`adminlogin:${key}`, ADMIN_LOGIN_TRIES, ADMIN_LOGIN_WINDOW_SEC) });
  }

  async listFeedback(q: FeedbackQuery): Promise<ServiceResult<{ items: FeedbackEntry[]; total: number; open: number }>> {
    const store = this.deps.feedback;
    if (!store) return fail(503, OFF);
    const all = await store.recent(FEEDBACK_SCAN);
    const category = FEEDBACK_CATEGORIES.find((c) => c === q.category);
    const items = all.filter((e) => (!category || e.category === category) && (q.handled === undefined || e.handled === q.handled));
    return ok({ items: items.slice(0, q.limit), total: all.length, open: all.filter((e) => !e.handled).length });
  }

  async setHandled(id: number, handled: boolean): Promise<ServiceResult<FeedbackEntry>> {
    const store = this.deps.feedback;
    if (!store) return fail(503, OFF);
    const entry = await store.get(id);
    if (!entry) return fail(404, "Không tìm thấy góp ý");
    const next = { ...entry, handled };
    await store.update(next);
    return ok(next);
  }

  async deleteFeedback(id: number): Promise<ServiceResult<null>> {
    const store = this.deps.feedback;
    if (!store) return fail(503, OFF);
    return (await store.remove(id)) ? ok(null) : fail(404, "Không tìm thấy góp ý");
  }

  async stats(): Promise<ServiceResult<TelemetryStats>> {
    const store = this.deps.telemetry;
    if (!store) return fail(503, OFF);
    const today = this.deps.now();
    const dates = Array.from({ length: STATS_DATES }, (_, i) => utcDate(today - i * 86_400_000));
    return ok(await store.stats(dates));
  }

  async lookupSave(rawCode: string): Promise<ServiceResult<{ code: string; save: SaveData; raw: unknown }>> {
    const code = normalizeRecoveryCode(rawCode);
    if (!code) return fail(400, "Mã khôi phục không hợp lệ");
    const store = this.deps.saves;
    if (!store) return fail(503, OFF);
    const raw = await store.get(code);
    const save = migrate(raw);
    if (!save) return fail(404, "Không tìm thấy bản lưu với mã này");
    return ok({ code, save, raw });
  }

  async announcement(): Promise<ServiceResult<Announcement | null>> {
    const store = this.deps.announcement;
    if (!store) return fail(503, OFF);
    return ok(await store.get());
  }

  async postAnnouncement(raw: unknown): Promise<ServiceResult<Announcement>> {
    const store = this.deps.announcement;
    if (!store) return fail(503, OFF);
    const a = parseAnnouncementDraft(raw, this.deps.now());
    if (!a) return fail(400, "Nội dung thông báo chưa hợp lệ (1–280 ký tự)");
    await store.set(a);
    return ok(a);
  }

  async clearAnnouncement(): Promise<ServiceResult<null>> {
    const store = this.deps.announcement;
    if (!store) return fail(503, OFF);
    await store.clear();
    return ok(null);
  }
}
