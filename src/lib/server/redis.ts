import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/** Lazily creates the Upstash client. Returns null when the store is not configured. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/** Fixed-window rate limit. Allows the request when Redis is unavailable. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const count = await redis.incr(bucket);
    if (count === 1) await redis.expire(bucket, windowSec);
    return count <= limit;
  } catch {
    return true;
  }
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}
