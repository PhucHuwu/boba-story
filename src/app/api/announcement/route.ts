import { connection } from "next/server";
import { serverServices } from "@/composition/server";

export async function GET() {
  await connection();
  const announcement = await serverServices().community.currentAnnouncement().catch(() => null);
  return Response.json({ announcement }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } });
}
