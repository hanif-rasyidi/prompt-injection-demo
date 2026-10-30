// ① Break the Bot, self-paced. Each student picks their own level; their code is
// derived per student and per level (lib/flag.js). Students must NEVER see a raw
// error, so every failure path returns a friendly message.
import { codeSystem, policySystem, cracked, MAX_LEVEL } from "../../../lib/ctf.js";
import { allow } from "../../../lib/store.js";
import { chatMessages } from "../../../lib/llm.js";
import { studentFlag } from "../../../lib/flag.js";

export async function POST(req) {
  const body = await req.json();
  const message = String(body.message ?? "");
  const id = String(body.id ?? "anon").replace(/[^a-z0-9]/gi, "").slice(0, 32) || "anon";
  const level = Math.min(Math.max(Number(body.level) || 1, 1), MAX_LEVEL);

  // 4000 chars so L5 "instruction flooding" attacks are actually possible.
  if (message.length > 4000) return Response.json({ level, reply: "That message is too long. Keep it under 4000 characters." });
  if (!(await allow(id))) return Response.json({ level, reply: "⏳ One at a time. Wait a few seconds and try again." });

  const flag = studentFlag(id, level);
  try {
    const reply = await chatMessages([
      { role: "system", content: codeSystem(flag) }, // the secret
      { role: "system", content: policySystem(level) }, // the level's defense
      { role: "user", content: message },
    ]);
    // Typing the code yourself doesn't count; the bot has to leak it.
    const won = cracked(level, flag, reply) && !cracked(level, flag, message);
    return Response.json({ level, reply, cracked: won });
  } catch (e) {
    console.error("chat error:", String(e.message || e).slice(0, 200));
    return Response.json({ level, busy: true, reply: "The lab's AI is busy right now (lots of students). Wait about 30 seconds, then send again." });
  }
}
