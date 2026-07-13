// SCENARIO ② backend — "Ask the Docs" RAG. Retrieves KB articles for the question,
// then answers. The poisoned community article carries a hidden instruction; with
// defenses off the assistant obeys it and phishes the user. Same defense layers as
// the console: L1 delimit retrieved docs, L2 instruction hierarchy, L3 link
// allowlist, L4 input cap.
import { retrieve, docsVulnerableSystem, docsHardenedSystem, DOCS_FIXTURES, secretLeaked, CONFIDENTIAL_KEY, CONFIDENTIAL_LABEL, attackContext, attackMessages, leakedSecrets } from "../../../lib/docs.js";
import { chat, chatMessages } from "../../../lib/llm.js";
import { wrapUntrusted, allowlistOutput } from "../../../lib/sanitize.js";
import { MAX_INPUT_CHARS, resolveModel } from "../../../lib/config.js";
import { plantArticle, getPlanted, clearPlanted } from "../../../lib/store.js";

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

  // "Your turn" heist: the attendee plants poisoned articles (persisted per browser id)
  // and tries to make the assistant leak any seeded secret. Actions: plant / clear / ask.
  if (body.mode === "attack") {
    const id = String(body.id ?? "anon").slice(0, 64);
    const action = body.action ?? "ask";

    if (action === "plant") {
      const planted = await plantArticle(id, { title: body.title, body: body.article, trigger: body.trigger });
      return Response.json({ planted });
    }
    if (action === "clear") {
      await clearPlanted(id);
      return Response.json({ planted: [] });
    }
    if (action === "list") {
      return Response.json({ planted: await getPlanted(id) });
    }

    // ask — feed official docs + the confidential vault + this attendee's planted
    // articles to the model, then check which seeded secrets survived.
    const planted = await getPlanted(id);
    const ctx = attackContext({ planted, question, delimit: L.delimit });
    if (L.cap && ctx.length > MAX_INPUT_CHARS) {
      return Response.json({ reply: `⚠ Answer withheld: context (${ctx.length} chars) exceeds the ${MAX_INPUT_CHARS}-char cap (Layer 4).`, blocked: 1, leaked: [], won: false, planted, defensesOn, layers: L });
    }
    const msgs = attackMessages({ planted, question, hardened: L.hierarchy, delimit: L.delimit });
    const mdl = resolveModel(body.model);
    for (let attempt = 0; attempt < 2; attempt++) { // retry once on transient provider 5xx under live load
      try {
        let reply = await chatMessages(msgs, mdl);
        let blocked = 0;
        if (L.allowlist) { const r = allowlistOutput(reply); reply = r.clean; blocked = r.blocked; }
        const leaked = leakedSecrets(reply); // AFTER L3
        return Response.json({ reply, blocked, leaked, won: leaked.length > 0, planted, defensesOn, layers: L });
      } catch (e) {
        if (attempt === 1) return Response.json({ error: String(e.message || e) }, { status: 500 });
      }
    }
  }

  // Guided demo — poison toggle: drop the community article to show the "before" flow.
  const poison = body.poison !== false;
  const docs = retrieve(question).filter((d) => poison || !d.poisoned);

  // No article matched — answer honestly instead of guessing (and don't invoke the
  // model at all, so the "no information" answer is guaranteed).
  if (docs.length === 0) {
    return Response.json({
      reply: DOCS_FIXTURES.noinfo, blocked: 0, docs: [], poisoned: false,
      leaked: false, nomatch: true, defensesOn, layers: L,
      model: demo ? "demo" : resolveModel(body.model),
    });
  }

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
      // Deterministic replay: poisoned → safe (hardened) / leak (vulnerable);
      // poison toggled off → the original clean reset flow; else a benign answer.
      reply = poisoned ? (L.hierarchy ? DOCS_FIXTURES.safe : DOCS_FIXTURES.leak)
            : !poison ? DOCS_FIXTURES.clean
            : DOCS_FIXTURES.benign;
    } else {
      reply = await chat(system, user, model);
    }

    let blocked = 0;
    if (L.allowlist) {
      const r = allowlistOutput(reply); // L3 — neutralise any exfil link/image
      reply = r.clean;
      blocked = r.blocked;
    }

    // Did the confidential recovery key survive into the answer? Check AFTER L3 so a
    // key smuggled only inside a stripped URL correctly reads as blocked.
    const leaked = secretLeaked(reply);

    return Response.json({
      reply, blocked, docs: docs.map(meta), poisoned, poison, leaked,
      secret: CONFIDENTIAL_KEY, confidentialLabel: CONFIDENTIAL_LABEL,
      defensesOn, layers: L, model: demo ? "demo" : model,
    });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

// Only expose display metadata to the client (not the raw poisoned body unless asked).
function meta(d) {
  return { id: d.id, title: d.title, source: d.source, trusted: d.trusted, poisoned: Boolean(d.poisoned), confidential: Boolean(d.confidential) };
}
