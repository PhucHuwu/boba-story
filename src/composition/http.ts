import "server-only";
import type { ServiceResult } from "@/application/cloud/cloudSaveService";
import { isAdminRequest } from "./server";

const MAX_BODY = 8_000;

/** Parses a small JSON body; returns undefined when it is missing, too large or malformed. */
export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function respond<T>(r: ServiceResult<T>, wrap: (v: T) => unknown = (v) => v) {
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status, headers: { "Cache-Control": "no-store" } });
  return Response.json(wrap(r.value), { headers: { "Cache-Control": "no-store" } });
}

/** Runs an admin handler only for requests carrying the admin API key. */
export async function asAdmin(req: Request, handler: () => Promise<Response>): Promise<Response> {
  if (!isAdminRequest(req)) return Response.json({ error: "Không có quyền" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return handler();
}
