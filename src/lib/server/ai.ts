/**
 * Server-only client for the OpenAI-compatible AI proxy.
 * The API key never leaves the server; the browser only talks to /api/* routes.
 */
export function aiConfigured(): boolean {
  return Boolean(process.env.AI_PROXY_BASE_URL && process.env.AI_PROXY_API_KEY);
}

export async function chatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  if (!aiConfigured()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const res = await fetch(`${process.env.AI_PROXY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AI_PROXY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_CHAT_MODEL || "gemini-3-flash",
        messages,
        max_tokens: opts.maxTokens ?? 120,
        temperature: opts.temperature ?? 0.9,
      }),
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
