import type { CloudSaveGateway, DialogueGateway, DialogueRequest, GatewayResult } from "@/application/ports";
import type { SaveData } from "@/domain/types";

const OFFLINE = "Không có kết nối mạng";

async function errorMessage(res: Response, fallback: string) {
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error ?? fallback;
}

/** Client adapter for `/api/save`. */
export class HttpCloudSaveGateway implements CloudSaveGateway {
  constructor(private readonly endpoint = "/api/save") {}

  async upload(code: string, data: SaveData): Promise<GatewayResult<null>> {
    try {
      const res = await fetch(this.endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, save: data }),
      });
      return res.ok ? { ok: true, value: null } : { ok: false, message: await errorMessage(res, "Không thể lưu đám mây") };
    } catch {
      return { ok: false, message: OFFLINE };
    }
  }

  async download(code: string): Promise<GatewayResult<unknown>> {
    try {
      const res = await fetch(`${this.endpoint}?code=${encodeURIComponent(code.trim().toUpperCase())}`);
      if (!res.ok) return { ok: false, message: await errorMessage(res, "Không tìm thấy bản lưu") };
      const json = (await res.json()) as { save?: unknown };
      return { ok: true, value: json.save };
    } catch {
      return { ok: false, message: OFFLINE };
    }
  }
}

/** Client adapter for `/api/dialogue`. Only returns lines that actually came from the AI or its cache. */
export class HttpDialogueGateway implements DialogueGateway {
  constructor(private readonly endpoint = "/api/dialogue") {}

  async line(req: DialogueRequest): Promise<string | null> {
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { line?: string; source?: string };
      return json.line && json.source !== "fallback" ? json.line : null;
    } catch {
      return null;
    }
  }
}
