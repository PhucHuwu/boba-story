import { asAdmin, readJson, respond } from "@/composition/http";
import { serverServices } from "@/composition/server";

const idOf = (raw: string) => (/^\d{1,12}$/.test(raw) ? Number(raw) : null);
const badId = () => Response.json({ error: "Mã góp ý không hợp lệ" }, { status: 400 });

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return asAdmin(req, async () => {
    const id = idOf((await ctx.params).id);
    if (id === null) return badId();
    const body = (await readJson(req)) as { handled?: unknown } | undefined;
    if (typeof body?.handled !== "boolean") return Response.json({ error: "Thiếu trạng thái" }, { status: 400 });
    return respond(await serverServices().admin.setHandled(id, body.handled));
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return asAdmin(req, async () => {
    const id = idOf((await ctx.params).id);
    if (id === null) return badId();
    return respond(await serverServices().admin.deleteFeedback(id), () => ({ ok: true }));
  });
}
