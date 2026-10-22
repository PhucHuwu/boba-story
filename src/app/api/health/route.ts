import { connection } from "next/server";
import { serverServices } from "@/composition/server";

export async function GET() {
  await connection();
  return Response.json({ ok: true, ...serverServices().status, time: new Date().toISOString() });
}
