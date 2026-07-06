// SCENARIO ③ backend — the internal agent console, parameterized by a single
// "defenses" master (off = vulnerable, on = the 4 layers). Also supports model
// switching (robust↔weak) and deterministic demo mode.
import { hardenedSystem, vulnerableSystem } from "../../../lib/prompts.js";
import { sensitiveContext } from "../../../lib/secrets.js";
import { chat } from "../../../lib/llm.js";
import { wrapUntrusted, allowlistOutput } from "../../../lib/sanitize.js";
import { MAX_INPUT_CHARS, resolveModel } from "../../../lib/config.js";
import { FIXTURES } from "../../../lib/fixtures.js";

export async function POST(req) {
  const origin = new URL(req.url).origin;
  const body = await req.json();
  const source = body.source ?? ""; // the RAW ticket source (with hidden payload)
  const demo = body.demo === true;
  const defensesOn = body.defenses === "on";

  // Defenses OFF → every layer disabled (pure vulnerable app). ON → granular.
  const L = defensesOn
    ? {
        delimit: body.layers?.delimit ?? true, // L1
        hierarchy: body.layers?.hierarchy ?? true, // L2
        allowlist: body.layers?.allowlist ?? true, // L3
        cap: body.layers?.cap ?? true, // L4
      }
    : { delimit: false, hierarchy: false, allowlist: false, cap: false };

  // LAYER 4 — token/rate cap.
  if (L.cap && source.length > MAX_INPUT_CHARS) {
    return Response.json({
      reply: `⚠ Ticket rejected: ${source.length} chars exceeds the ${MAX_INPUT_CHARS}-char cap (Layer 4).`,
      blocked: 1,
      layers: L,
      defensesOn,
    });
  }

  const context = sensitiveContext();
  const system = L.hierarchy ? hardenedSystem(context) : vulnerableSystem(context); // L2
  const fenced = L.delimit ? wrapUntrusted(source) : source; // L1
  const user = `Please summarize this support ticket:\n\n${fenced}`;
  const model = resolveModel(body.model);

  try {
    let reply;
    if (demo) {
      // Replay a REAL captured output for the matching situation.
      if (body.poisoned === false) reply = body.benignSummary || FIXTURES.benign; // benign ticket → clean, ticket-specific summary
      else if (!defensesOn) reply = FIXTURES.vulnLeak; // vulnerable app leaks
      else reply = body.model === "weak" || !L.hierarchy ? FIXTURES.weakLeak : FIXTURES.refusalRobust;
      reply = reply.replaceAll("COLLECT_ORIGIN", origin);
    } else {
      reply = await chat(system, user, model);
    }

    let blocked = 0;
    if (L.allowlist) {
      const r = allowlistOutput(reply); // L3
      reply = r.clean;
      blocked = r.blocked;
    }

    return Response.json({ reply, blocked, layers: L, defensesOn, model: demo ? "demo" : model });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
