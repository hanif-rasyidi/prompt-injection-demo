// SCENARIO ② backend — "Ask the Docs" RAG. Retrieves KB articles for the question,
// then answers. The poisoned community article carries a hidden instruction; with
// defenses off the assistant obeys it and phishes the user. Same defense layers as
// the console: L1 delimit retrieved docs, L2 instruction hierarchy, L3 link
// allowlist, L4 input cap.
import { retrieve, docsVulnerableSystem, docsHardenedSystem, DOCS_FIXTURES } from "../../../lib/docs.js";
import { chat } from "../../../lib/llm.js";
import { wrapUntrusted, allowlistOutput } from "../../../lib/sanitize.js";
import { MAX_INPUT_CHARS, resolveModel } from "../../../lib/config.js";

export async function POST(req) {
  const body = await req.json();
  const question = String(body.question ?? "").slice(0, 500);
  const demo = body.demo === true;
  const defensesOn = body.defenses === "on";

  const L = defensesOn
    ? {
        delimit: body.layers?.delimit ?? true,
        hierarchy: body.layers?.hierarchy ?? true,
        allowlist: body.layers?.allowlist ?? true,
        cap: body.layers?.cap ?? true,
      }
    : { delimit: false, hierarchy: false, allowlist: false, cap: false };

  const docs = retrieve(question);
  const poisoned = docs.some((d) => d.poisoned);

  // Build the retrieved-context block (each article delimited as untrusted at L1).
  const context = docs
    .map((d) => {
      const block = `### ${d.title} — ${d.source}\n${d.body}`;
      return L.delimit ? wrapUntrusted(block) : block;
    })
    .join("\n\n");

  // LAYER 4 — input cap (retrieved context can be attacker-inflated).
  if (L.cap && context.length > MAX_INPUT_CHARS) {
    return Response.json({
      reply: `⚠ Answer withheld: retrieved context (${context.length} chars) exceeds the ${MAX_INPUT_CHARS}-char cap (Layer 4).`,
      blocked: 1, docs: docs.map(meta), poisoned, defensesOn, layers: L,
    });
  }

  const system = L.hierarchy ? docsHardenedSystem(context) : docsVulnerableSystem(context);
  const user = `Question: ${question}`;
  const model = resolveModel(body.model);

  try {
    let reply;
    if (demo) {
      reply = !poisoned ? DOCS_FIXTURES.benign : L.hierarchy ? DOCS_FIXTURES.safe : DOCS_FIXTURES.phish;
    } else {
      reply = await chat(system, user, model);
    }

    let blocked = 0;
    if (L.allowlist) {
      const r = allowlistOutput(reply); // L3 — neutralise the phishing link
      reply = r.clean;
      blocked = r.blocked;
    }

    return Response.json({ reply, blocked, docs: docs.map(meta), poisoned, defensesOn, layers: L, model: demo ? "demo" : model });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

// Only expose display metadata to the client (not the raw poisoned body unless asked).
function meta(d) {
  return { id: d.id, title: d.title, source: d.source, trusted: d.trusted, poisoned: Boolean(d.poisoned) };
}
