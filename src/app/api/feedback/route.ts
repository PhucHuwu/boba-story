import { readJson, respond } from "@/composition/http";
import { clientId, serverServices } from "@/composition/server";

export async function POST(req: Request) {
  const r = await serverServices().community.submitFeedback(await readJson(req), clientId(req), req.headers.get("user-agent") ?? "");
  return respond(r);
}
