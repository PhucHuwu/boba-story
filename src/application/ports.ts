/**
 * Ports (interfaces) owned by the application layer.
 * Infrastructure adapters implement them; the composition root wires them in.
 */
import type { ArchetypeId, SaveData } from "@/domain/types";

// ---------- client-side ports ----------

/** Persistence of the save on this device. */
export interface SaveRepository {
  load(): SaveData | null;
  save(data: SaveData): boolean;
  clear(): void;
}

/** Remembers this device's anonymous recovery code. */
export interface RecoveryCodeStore {
  get(): string;
  set(code: string): void;
}

export type GatewayResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Remote cloud-save service as seen from the client. */
export interface CloudSaveGateway {
  upload(code: string, data: SaveData): Promise<GatewayResult<null>>;
  /** Returns unvalidated save data; the application validates it. */
  download(code: string): Promise<GatewayResult<unknown>>;
}

export type DialogueEvent = "order" | "happy" | "sad" | "leave" | "review";

export interface DialogueRequest {
  archetype: ArchetypeId;
  event: DialogueEvent;
  recipeId: string;
  stage: number;
}

/** Source of AI-written customer lines. Returns null when unavailable. */
export interface DialogueGateway {
  line(req: DialogueRequest): Promise<string | null>;
}

export type Rng = () => number;

// ---------- server-side ports ----------

export interface CloudSaveStore {
  get(code: string): Promise<unknown | null>;
  put(code: string, data: SaveData, ttlSec: number): Promise<void>;
}

export interface RateLimiter {
  allow(key: string, limit: number, windowSec: number): Promise<boolean>;
}

export interface TextCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TextGenerator {
  generate(messages: ChatMessage[], opts?: { maxTokens?: number; timeoutMs?: number }): Promise<string | null>;
}
