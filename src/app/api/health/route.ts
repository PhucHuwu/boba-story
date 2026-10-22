import { connection } from "next/server";
import { aiConfigured } from "@/lib/server/ai";
import { getRedis } from "@/lib/server/redis";

export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    cloudSave: getRedis() !== null,
    aiDialogue: aiConfigured(),
    time: new Date().toISOString(),
  });
}
