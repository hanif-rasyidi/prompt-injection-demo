// Read/clear the attacker's capture log (used by the /attacker panel).
export async function GET() {
  return Response.json({ captures: globalThis.__captures ?? [] });
}

export async function DELETE() {
  globalThis.__captures = [];
  return Response.json({ ok: true });
}
