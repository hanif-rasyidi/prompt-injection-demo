// CTF chat endpoint. Participants attack the bot to extract the current level's
// flag. Applies that level's cumulative defenses. Participants must NEVER see a
// raw error, so every failure path returns a friendly message.
import { codeSystem, policySystem, inputBlocked, scrubOutput, cracked } from "../../../lib/ctf.js";
import { getState, allow } from "../../../lib/store.js";
import { chatMessages, DEFAULT_MODEL } from "../../../lib/llm.js";

// CTF model (IONEXT gemma by default; override with CTF_MODEL). Provider is paid,
// so no per-minute free cap — needed for 100 simultaneous participants.
const CTF_MODEL = process.env.CTF_MODEL || DEFAULT_MODEL;

async function chatWithRetry(messages) {
  for (let i = 0; i < 2; i++) {
    try {
      return await chatMessages(messages, CTF_MODEL);
    } catch (e) {
      if (i === 1) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function POST(req) {
  const { message = "", id = "anon" } = await req.json();

  // 4000 chars so L5 "instruction flooding" attacks are actually possible.
  if (message.length > 4000) return Response.json({ reply: "That message is too long — keep it under 4000 characters." });
  if (!(await allow(id))) return Response.json({ reply: "⏳ One at a time — wait a second and try again." });

  const { level, flag } = await getState();

  if (inputBlocked(level, message)) {
    return Response.json({ level, reply: "⚠ That looked like an attack and was blocked by the input filter.", cracked: false });
  }

  try {
    let reply = await chatWithRetry([
      { role: "system", content: codeSystem(flag) }, // the secret (never shown to audience)
      { role: "system", content: policySystem(level) }, // the defense policy (shown in /admin)
      { role: "user", content: message },
    ]);
    const s = scrubOutput(level, flag, reply);
    reply = s.text;
    return Response.json({ level, reply, cracked: cracked(level, flag, reply), scrubbed: s.scrubbed });
  } catch {
    return Response.json({ level, reply: "The assistant is busy right now — try again in a moment." });
  }
}
