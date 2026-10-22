import { Redis } from "@upstash/redis";
import type { CloudSaveStore, RateLimiter, TextCache } from "@/application/ports";
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
