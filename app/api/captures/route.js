// Read/clear one student's private capture log (used by the attacker panel). No id means an empty list.
import { getCaptures, clearCaptures } from "../../../lib/store.js";

const sid = (req) => (new URL(req.url).searchParams.get("s") || "").replace(/[^a-z0-9]/gi, "").slice(0, 32);

export async function GET(req) {
  return Response.json({ captures: await getCaptures(sid(req)) });
}

export async function DELETE(req) {
  await clearCaptures(sid(req));
  return Response.json({ ok: true });
}
