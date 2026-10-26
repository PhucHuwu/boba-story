import { asAdmin, readJson, respond } from "@/composition/http";
import { serverServices } from "@/composition/server";

export async function GET(req: Request) {
  return asAdmin(req, async () => respond(await serverServices().admin.announcement(), (announcement) => ({ announcement })));
}

export async function PUT(req: Request) {
  return asAdmin(req, async () => respond(await serverServices().admin.postAnnouncement(await readJson(req)), (announcement) => ({ announcement })));
}

export async function DELETE(req: Request) {
  return asAdmin(req, async () => respond(await serverServices().admin.clearAnnouncement(), () => ({ ok: true })));
}
