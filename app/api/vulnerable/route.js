// THE WEAK APP. No delimiting, no allowlist, no cap. The ticket is concatenated
// like a trusted instruction and the model's raw output is returned untouched.
// Supports deterministic demo mode (replay a real captured leak, no API call).
import { vulnerableSystem } from "../../../lib/prompts.js";
import { sensitiveContext } from "../../../lib/secrets.js";
import { chat } from "../../../lib/llm.js";
import { FIXTURES } from "../../../lib/fixtures.js";

export async function POST(req) {
  const origin = new URL(req.url).origin;
  const { ticket = "", demo = false } = await req.json();
  try {
    let reply;
    if (demo) {
      reply = FIXTURES.vulnLeak.replaceAll("COLLECT_ORIGIN", origin);
    } else {
      const system = vulnerableSystem(sensitiveContext());
      reply = await chat(system, `Please summarize this support ticket:\n\n${ticket}`);
    }
    return Response.json({ reply, blocked: 0, layers: null });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
