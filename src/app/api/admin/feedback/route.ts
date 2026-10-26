import { asAdmin, respond } from "@/composition/http";
import { serverServices } from "@/composition/server";

export async function GET(req: Request) {
  return asAdmin(req, async () => {
    const q = new URL(req.url).searchParams;
    const handled = q.get("handled");
    const limit = Math.min(500, Math.max(1, Number(q.get("limit")) || 100));
    const r = await serverServices().admin.listFeedback({
      category: q.get("category") ?? undefined,
      handled: handled === "true" ? true : handled === "false" ? false : undefined,
      limit,
    });
    return respond(r);
  });
}
