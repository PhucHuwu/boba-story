import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { CloudSaveService } from "@/application/cloud/cloudSaveService";
import { AdminService, CommunityService, type CommunityDeps } from "@/application/community/communityService";
import { DialogueService } from "@/application/dialogue/dialogueService";
import { OpenAiCompatibleTextGenerator, aiConfigFromEnv } from "@/infrastructure/server/openAiCompatible";
import {
  RedisAnnouncementStore,
  RedisCloudSaveStore,
  RedisFeedbackStore,
  RedisRateLimiter,
  RedisTelemetryStore,
  RedisTextCache,
  createRedisFromEnv,
} from "@/infrastructure/server/upstash";

/** Server composition root: the only place that picks concrete adapters for server use cases. */
function build() {
  const redis = createRedisFromEnv();
  const ai = aiConfigFromEnv();
  const limiter = new RedisRateLimiter(redis);
  const saves = redis ? new RedisCloudSaveStore(redis) : null;
  const community: CommunityDeps = {
    feedback: redis ? new RedisFeedbackStore(redis) : null,
    telemetry: redis ? new RedisTelemetryStore(redis) : null,
    announcement: redis ? new RedisAnnouncementStore(redis) : null,
    saves,
    limiter,
    now: Date.now,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  };
  return {
    status: { cloudSave: redis !== null, aiDialogue: ai !== null, admin: !!process.env.ADMIN_API_KEY },
    cloudSaves: new CloudSaveService({ store: saves, limiter, now: Date.now }),
    community: new CommunityService(community),
    admin: new AdminService(community),
    dialogue: new DialogueService({
      generator: ai ? new OpenAiCompatibleTextGenerator(ai) : null,
      cache: redis ? new RedisTextCache(redis) : null,
      limiter,
      rng: Math.random,
    }),
  };
}

let services: ReturnType<typeof build> | undefined;

export function serverServices() {
  return (services ??= build());
}

export function clientId(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}

/**
 * Server-to-server auth for `/api/admin/*`: the admin app sends `Authorization: Bearer <ADMIN_API_KEY>`.
 * Disabled entirely (always false) when the key is not configured.
 */
export function isAdminRequest(req: Request): boolean {
  const key = process.env.ADMIN_API_KEY;
  if (!key || key.length < 32) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(key).digest();
  return timingSafeEqual(a, b);
}
