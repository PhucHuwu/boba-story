import { clientId, serverServices } from "@/composition/server";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const r = await serverServices().cloudSaves.load(code, clientId(req));
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ save: r.value }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const r = await serverServices().cloudSaves.store(await req.text(), clientId(req));
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ok: true, updatedAt: r.value.updatedAt });
}
