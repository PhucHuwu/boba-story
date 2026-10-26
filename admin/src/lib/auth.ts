import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSessionToken } from "./session";

/** Full session check for pages and server actions (the proxy only does an early redirect). */
export async function requireAdmin() {
  const session = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");
  return session;
}

export async function visitorIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
