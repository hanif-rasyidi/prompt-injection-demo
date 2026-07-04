// THE STRONG APP. Four independent layers, each toggleable from the UI so you can
// demonstrate defense-in-depth live (turn Layer 3 off → it still leaks; on → blocked).
// Also supports model switching (robust↔weak) and deterministic demo mode.
import { hardenedSystem, vulnerableSystem } from "../../../lib/prompts.js";
import { sensitiveContext } from "../../../lib/secrets.js";
import { chat } from "../../../lib/llm.js";
import { wrapUntrusted, allowlistOutput } from "../../../lib/sanitize.js";
import { MAX_INPUT_CHARS, resolveModel } from "../../../lib/config.js";
import { FIXTURES } from "../../../lib/fixtures.js";

export async function POST(req) {
  const origin = new URL(req.url).origin;
  const body = await req.json();
  const ticket = body.ticket ?? "";
  const demo = body.demo === true; // deterministic mode: replay a real capture

  // Which layers are ON. Default: all four. The UI sends these booleans.
  const L = {
    delimit: body.layers?.delimit ?? true, // Layer 1: input delimiting
    hierarchy: body.layers?.hierarchy ?? true, // Layer 2: instruction hierarchy
    allowlist: body.layers?.allowlist ?? true, // Layer 3: output allowlisting
    cap: body.layers?.cap ?? true, // Layer 4: token/rate cap
  };

  // LAYER 4 — per-session token/rate cap (bounds cost abuse: the Chevrolet lesson).
  if (L.cap && ticket.length > MAX_INPUT_CHARS) {
    return Response.json({
      reply: `⚠ Ticket rejected: ${ticket.length} chars exceeds the ${MAX_INPUT_CHARS}-char cap (Layer 4).`,
      blocked: 1,
      layers: L,
    });
  }

  const context = sensitiveContext();
  // LAYER 2 — instruction-hierarchy prompt (vs the naive one when toggled off).
  const system = L.hierarchy ? hardenedSystem(context) : vulnerableSystem(context);
  // LAYER 1 — input delimiting (fence the untrusted ticket).
  const fenced = L.delimit ? wrapUntrusted(ticket) : ticket;
  const user = `Please summarize this support ticket:\n\n${fenced}`;
  const model = resolveModel(body.model);

  try {
    let reply;
    if (demo) {
      // Replay a REAL captured output: weak model (or hierarchy off) leaks; the
      // robust model refuses. The layer code below still runs for real.
      const leaks = body.model === "weak" || !L.hierarchy;
      reply = (leaks ? FIXTURES.weakLeak : FIXTURES.refusalRobust).replaceAll("COLLECT_ORIGIN", origin);
    } else {
      reply = await chat(system, user, model);
    }

    let blocked = 0;
    // LAYER 3 — output/link allowlisting (the real backstop).
    if (L.allowlist) {
      const r = allowlistOutput(reply);
      reply = r.clean;
      blocked = r.blocked;
    }

    return Response.json({ reply, blocked, layers: L, model: demo ? "demo" : model });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
