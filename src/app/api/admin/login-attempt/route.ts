import { asAdmin, readJson, respond } from "@/composition/http";
import { serverServices } from "@/composition/server";

/** Counts one admin login attempt for `key` and says whether it is still allowed. */
export async function POST(req: Request) {
  return asAdmin(req, async () => {
    const body = (await readJson(req)) as { key?: unknown } | undefined;
    return respond(await serverServices().admin.allowLogin(typeof body?.key === "string" ? body.key : ""));
  });
}
