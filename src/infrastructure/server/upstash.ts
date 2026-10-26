import { Redis } from "@upstash/redis";
import type { AnnouncementStore, CloudSaveStore, FeedbackStore, RateLimiter, TelemetryStore, TextCache } from "@/application/ports";
import type { Announcement, DayAggregate, DayTelemetry, FeedbackEntry, TelemetryStats } from "@/domain/community";
import type { SaveData } from "@/domain/types";

/** Creates the Upstash client from Vercel Marketplace env vars, or null when not configured. */
export function createRedisFromEnv(env: NodeJS.ProcessEnv = process.env): Redis | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export class RedisCloudSaveStore implements CloudSaveStore {
  constructor(private readonly redis: Redis) {}

  get(code: string) {
    return this.redis.get<unknown>(`save:${code}`);
  }

  async put(code: string, data: SaveData, ttlSec: number) {
    await this.redis.set(`save:${code}`, data, { ex: ttlSec });
  }
}

export class RedisTextCache implements TextCache {
  constructor(private readonly redis: Redis) {}

  get(key: string) {
    return this.redis.get<string>(key);
  }

  async set(key: string, value: string, ttlSec: number) {
    await this.redis.set(key, value, { ex: ttlSec });
  }
}

/** Fixed-window limiter. Fails open so a Redis outage never blocks play. */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis | null) {}

  async allow(key: string, limit: number, windowSec: number) {
    if (!this.redis) return true;
    try {
      const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
      const count = await this.redis.incr(bucket);
      if (count === 1) await this.redis.expire(bucket, windowSec);
      return count <= limit;
    } catch {
      return true;
    }
  }
}

const FEEDBACK_KEEP = 2000;

/** Feedback entries as JSON keys plus a sorted-set index by id (newest = highest). */
export class RedisFeedbackStore implements FeedbackStore {
  constructor(private readonly redis: Redis) {}

  async add(entry: Omit<FeedbackEntry, "id">) {
    const id = await this.redis.incr("fb:seq");
    const full: FeedbackEntry = { ...entry, id };
    await this.redis.set(`fb:${id}`, full);
    await this.redis.zadd("fb:index", { score: id, member: String(id) });
    const extra = (await this.redis.zcard("fb:index")) - FEEDBACK_KEEP;
    if (extra > 0) {
      const old = await this.redis.zrange<string[]>("fb:index", 0, extra - 1);
      if (old.length) {
        await this.redis.del(...old.map((o) => `fb:${o}`));
        await this.redis.zrem("fb:index", ...old);
      }
    }
    return full;
  }

  async recent(max: number) {
    const ids = await this.redis.zrange<string[]>("fb:index", 0, max - 1, { rev: true });
    if (!ids.length) return [];
    const rows = await this.redis.mget<(FeedbackEntry | null)[]>(...ids.map((i) => `fb:${i}`));
    return rows.filter((r): r is FeedbackEntry => r !== null);
  }

  get(id: number) {
    return this.redis.get<FeedbackEntry>(`fb:${id}`);
  }

  async update(entry: FeedbackEntry) {
    await this.redis.set(`fb:${entry.id}`, entry);
  }

  async remove(id: number) {
    const n = await this.redis.del(`fb:${id}`);
    await this.redis.zrem("fb:index", String(id));
    return n > 0;
  }
}

const AGG_FIELDS = ["reports", "served", "lost", "qualitySum", "perfect", "profitSum", "losingDays", "moneySum", "reputationSum", "goalsMet", "relaxed"] as const;
const DATE_TTL_SEC = 60 * 60 * 24 * 40;
const MAX_DAYS = 60;

/** Running totals per game day number (hash `tm:day:N`) and a report counter per calendar date. */
export class RedisTelemetryStore implements TelemetryStore {
  constructor(private readonly redis: Redis) {}

  async record(r: DayTelemetry, date: string) {
    const key = `tm:day:${r.day}`;
    const inc: Record<(typeof AGG_FIELDS)[number], number> = {
      reports: 1,
      served: r.served,
      lost: r.lost,
      qualitySum: r.avgQuality,
      perfect: r.perfect,
      profitSum: r.profit,
      losingDays: r.profit < 0 ? 1 : 0,
      moneySum: r.money,
      reputationSum: r.reputation,
      goalsMet: r.goalMet ? 1 : 0,
      relaxed: r.relaxed ? 1 : 0,
    };
    const p = this.redis.pipeline();
    for (const f of AGG_FIELDS) if (inc[f]) p.hincrby(key, f, inc[f]);
    p.zadd("tm:days", { score: r.day, member: String(r.day) });
    p.incr(`tm:date:${date}`);
    p.expire(`tm:date:${date}`, DATE_TTL_SEC);
    await p.exec();
  }

  async stats(dates: string[]): Promise<TelemetryStats> {
    const days = (await this.redis.zrange<string[]>("tm:days", 0, MAX_DAYS - 1)).map(Number);
    const p = this.redis.pipeline();
    for (const d of days) p.hgetall(`tm:day:${d}`);
    const hashes = days.length ? ((await p.exec()) as (Record<string, unknown> | null)[]) : [];
    const counts = dates.length ? await this.redis.mget<(number | null)[]>(...dates.map((d) => `tm:date:${d}`)) : [];
    return {
      days: days.map((day, i) => {
        const h = hashes[i] ?? {};
        const agg = { day } as DayAggregate;
        for (const f of AGG_FIELDS) agg[f] = Number(h[f] ?? 0);
        return agg;
      }),
      daily: dates.map((date, i) => ({ date, reports: Number(counts[i] ?? 0) })),
    };
  }
}

export class RedisAnnouncementStore implements AnnouncementStore {
  constructor(private readonly redis: Redis) {}

  get() {
    return this.redis.get<Announcement>("announcement");
  }

  async set(a: Announcement) {
    await this.redis.set("announcement", a);
  }

  async clear() {
    await this.redis.del("announcement");
  }
}
