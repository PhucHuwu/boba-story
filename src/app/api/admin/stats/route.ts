import { asAdmin, respond } from "@/composition/http";
import { serverServices } from "@/composition/server";

export async function GET(req: Request) {
  return asAdmin(req, async () => respond(await serverServices().admin.stats()));
}
