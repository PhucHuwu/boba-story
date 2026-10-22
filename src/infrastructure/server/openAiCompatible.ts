import type { ChatMessage, TextGenerator } from "@/application/ports";

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function aiConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OpenAiCompatibleConfig | null {
  const baseUrl = env.AI_PROXY_BASE_URL;
  const apiKey = env.AI_PROXY_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model: env.AI_CHAT_MODEL || "gemini-3-flash" };
}

/** Talks to any OpenAI-compatible `/chat/completions` endpoint (the AI proxy). Server-only: holds the API key. */
export class OpenAiCompatibleTextGenerator implements TextGenerator {
  constructor(private readonly config: OpenAiCompatibleConfig) {}

  async generate(messages: ChatMessage[], opts: { maxTokens?: number; timeoutMs?: number } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.config.model, messages, max_tokens: opts.maxTokens ?? 120, temperature: 0.9 }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const json = await res.json();
      const text: unknown = json?.choices?.[0]?.message?.content;
      return typeof text === "string" ? text : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
