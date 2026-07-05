// Read/clear the attacker's capture log (used by the ③/④ attacker panel).
import { getCaptures, clearCaptures } from "../../../lib/store.js";

export async function GET() {
  return Response.json({ captures: await getCaptures() });
}

export async function DELETE() {
  await clearCaptures();
  return Response.json({ ok: true });
}
