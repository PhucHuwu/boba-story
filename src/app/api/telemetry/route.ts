import { readJson, respond } from "@/composition/http";
import { clientId, serverServices } from "@/composition/server";

export async function POST(req: Request) {
  const r = await serverServices().community.recordTelemetry(await readJson(req), clientId(req));
  return respond(r, () => ({ ok: true }));
}
