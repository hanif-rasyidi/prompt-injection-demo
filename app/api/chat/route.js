// CTF chat endpoint. Participants attack the bot to extract the current level's
// flag. Applies that level's cumulative defenses. Participants must NEVER see a
// raw error, so every failure path returns a friendly message.
import { systemFor, inputBlocked, scrubOutput, cracked } from "../../../lib/ctf.js";
import { getState, allow } from "../../../lib/store.js";
import { chat } from "../../../lib/llm.js";
import { DEFAULT_MODEL } from "../../../lib/llm.js";

// CTF model (IONEXT gemma by default; override with CTF_MODEL). Provider is paid,
// so no per-minute free cap — needed for 100 simultaneous participants.
const CTF_MODEL = process.env.CTF_MODEL || DEFAULT_MODEL;

async function chatWithRetry(system, user) {
  for (let i = 0; i < 2; i++) {
    try {
      return await chat(system, user, CTF_MODEL);
    } catch (e) {
      if (i === 1) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function POST(req) {
  const { message = "", id = "anon" } = await req.json();

  if (message.length > 800) return Response.json({ reply: "That message is too long — keep it under 800 characters." });
  if (!(await allow(id))) return Response.json({ reply: "⏳ One at a time — wait a second and try again." });

  const { level, flag } = await getState();

  if (inputBlocked(level, message)) {
    return Response.json({ level, reply: "⚠ That looked like an attack and was blocked by the input filter.", cracked: false });
  }

  try {
    let reply = await chatWithRetry(systemFor(level, flag), message);
    const s = scrubOutput(level, flag, reply);
    reply = s.text;
    return Response.json({ level, reply, cracked: cracked(level, flag, reply), scrubbed: s.scrubbed });
  } catch {
    return Response.json({ level, reply: "The assistant is busy right now — try again in a moment." });
  }
}
