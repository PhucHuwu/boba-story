import "server-only";
import { CloudSaveService } from "@/application/cloud/cloudSaveService";
import { DialogueService } from "@/application/dialogue/dialogueService";
import { OpenAiCompatibleTextGenerator, aiConfigFromEnv } from "@/infrastructure/server/openAiCompatible";
import { RedisCloudSaveStore, RedisRateLimiter, RedisTextCache, createRedisFromEnv } from "@/infrastructure/server/upstash";

/** Server composition root: the only place that picks concrete adapters for server use cases. */
function build() {
  const redis = createRedisFromEnv();
  const ai = aiConfigFromEnv();
  const limiter = new RedisRateLimiter(redis);
  return {
    status: { cloudSave: redis !== null, aiDialogue: ai !== null },
    cloudSaves: new CloudSaveService({ store: redis ? new RedisCloudSaveStore(redis) : null, limiter, now: Date.now }),
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
