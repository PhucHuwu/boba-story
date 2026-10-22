import { parseDialogueQuery } from "@/application/dialogue/dialogueService";
import { clientId, serverServices } from "@/composition/server";

export async function POST(req: Request) {
  const query = parseDialogueQuery(await req.json().catch(() => null));
  if (!query) return Response.json({ error: "Tham số không hợp lệ" }, { status: 400 });
  return Response.json(await serverServices().dialogue.line(query, clientId(req)));
}
