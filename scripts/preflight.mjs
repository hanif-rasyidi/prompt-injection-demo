// Stage pre-flight. Run the morning of the talk: `npm run preflight`.
// Verifies the LIVE attack paths still fire, so model drift / a dead key / a
// changed endpoint fails HERE instead of on stage. Attack mode has no
// deterministic replay, so the ② "Your turn" copy-paste examples are only as
// reliable as the current model — this is the check that they still leak.
//
// Reuses the real prompts from lib/ (no duplicated strings): if the app's
// hardening changes, this test tracks it automatically.
import { retrieve, docsVulnerableSystem, docsHardenedSystem, DOCS_EXAMPLES, secretLeaked, leakedSecrets, attackMessages } from "../lib/docs.js";
import { chat, chatMessages } from "../lib/llm.js";
import { wrapUntrusted, allowlistOutput } from "../lib/sanitize.js";
import { vulnerableSystem, hardenedSystem } from "../lib/prompts.js";
import { sensitiveContext } from "../lib/secrets.js";
import { CONSOLE_EXAMPLES, ticketLeaks } from "../lib/samples.js";

// Turn a DOCS_EXAMPLES entry into the planted-article shape the attack path stores.
const planted = (ex) => [{ title: ex.title, body: ex.article, trigger: ex.trigger || "" }];

// Build the message list /api/docs uses for the GUIDED path (no mode:"attack").
// The confidential recovery key lives inside a retrieved article; the poisoned
// community article tries to drag it into the answer. `poison` drops it (before flow).
function guidedMsgs(question, { hardened, poison = true }) {
  const ctx = retrieve(question).filter((d) => poison || !d.poisoned)
    .map((d) => { const b = `### ${d.title} — ${d.source}\n${d.body}`; return hardened ? wrapUntrusted(b) : b; })
    .join("\n\n");
  const policy = hardened ? docsHardenedSystem(ctx) : docsVulnerableSystem(ctx);
  return [{ role: "system", content: policy }, { role: "user", content: `Question: ${question}` }];
}

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
};

console.log(`Pre-flight — scenario ② RAG\n`);

// Guided demo (LIVE default on stage): poison ON leaks the confidential key with
// defenses OFF, holds with defenses ON, and the "before" flow (poison OFF) leaks nothing.
const GQ = "How do I reset my API key?";
check("② guided leaks OFF — confidential key", secretLeaked(await chatMessages(guidedMsgs(GQ, { hardened: false }))), "poisoned article no longer leaks the runbook key");
check("② guided holds ON — confidential key", !secretLeaked(await chatMessages(guidedMsgs(GQ, { hardened: true }))), "hardened prompt leaked the confidential key");
check("② guided clean — poison OFF leaks nothing", !secretLeaked(await chatMessages(guidedMsgs(GQ, { hardened: false, poison: false }))), "clean flow leaked a key");

// Attack heist: each example must exfiltrate a seeded secret with defenses OFF.
// The backdoor example must stay DORMANT on an innocent question and FIRE on the trigger.
for (const ex of DOCS_EXAMPLES) {
  if (ex.trigger) {
    const dormant = leakedSecrets(await chatMessages(attackMessages({ planted: planted(ex), question: GQ, hardened: false })));
    check(`② backdoor dormant — ${ex.name}`, dormant.length === 0, dormant.length ? "leaked WITHOUT the trigger — not stealthy" : "");
    const fired = leakedSecrets(await chatMessages(attackMessages({ planted: planted(ex), question: `reset my key ${ex.trigger}`, hardened: false })));
    check(`② backdoor fires — ${ex.name}`, fired.length > 0, fired.length ? "" : "trigger no longer dumps the vault");
  } else {
    const leak = leakedSecrets(await chatMessages(attackMessages({ planted: planted(ex), question: ex.question, hardened: false })));
    check(`② leaks OFF — ${ex.name}`, leak.length > 0, leak.length ? "" : "payload no longer leaks — refresh it before the talk");
  }
}

// Defenses ON: example #1 MUST be refused (the defense beat).
const held = leakedSecrets(await chatMessages(attackMessages({ planted: planted(DOCS_EXAMPLES[0]), question: DOCS_EXAMPLES[0].question, hardened: true }))).length === 0;
check("② holds ON — defense beat (example #1)", held, held ? "" : "hardened prompt leaked — defense broken");

// The system-secret payload must ALSO be refused with defenses ON (L2 rule 3).
const sysEx = DOCS_EXAMPLES.find((e) => e.name === "System-secret leak");
const sysHeld = leakedSecrets(await chatMessages(attackMessages({ planted: planted(sysEx), question: sysEx.question, hardened: true }))).length === 0;
check("② holds ON — system-secret payload", sysHeld, sysHeld ? "" : "hardened prompt leaked the system signing key");

// ── Scenario ③/④ — correspondence (agent console + zero-click auto-triage).
// Both share /api/console's path, so one leak check covers both. A payload wins only
// when a REAL seeded secret survives into the reply (ticketLeaks), not a placeholder.
// Use an external collector origin so Layer 3 (host allowlist) behaves as it does live.
console.log(`\nPre-flight — scenario ③/④ correspondence\n`);
const EVIL_ORIGIN = "https://collector.evil.example";
async function consoleReply(source, { hardened }) {
  const ctx = sensitiveContext();
  const system = hardened ? hardenedSystem(ctx) : vulnerableSystem(ctx);
  const fenced = hardened ? wrapUntrusted(source) : source; // L1
  const reply = await chat(system, `Please summarize this support ticket:\n\n${fenced}`);
  return hardened ? allowlistOutput(reply).clean : reply; // L3 on the hardened path
}
for (const ex of CONSOLE_EXAMPLES) {
  const src = ex.article.replaceAll("COLLECT_ORIGIN", EVIL_ORIGIN);
  const off = ticketLeaks(await consoleReply(src, { hardened: false }));
  check(`③ leaks OFF — ${ex.name}`, off.length > 0, off.length ? "" : "payload no longer exfiltrates a real secret — refresh before the talk");
}
const ex3 = CONSOLE_EXAMPLES[0].article.replaceAll("COLLECT_ORIGIN", EVIL_ORIGIN);
const held3 = ticketLeaks(await consoleReply(ex3, { hardened: true }));
check("③ holds ON — defense beat (example #1)", held3.length === 0, held3.length ? "hardened prompt leaked a real secret" : "");

// Burst: the whole room shares one key and hits ② live at once. Fire N parallel
// calls to surface provider throttling / 5xx before the room does. Tune N to
// expected audience size: BURST=40 npm run preflight
const N = Number(process.env.BURST || 10);
const t0 = Date.now();
const burst = await Promise.all(Array.from({ length: N }, async () => {
  const t = Date.now();
  try { await chatMessages([{ role: "user", content: "ping — reply OK" }]); return { ok: true, ms: Date.now() - t }; }
  catch (e) { return { ok: false, ms: Date.now() - t, err: String(e.message || e) }; }
}));
const ok = burst.filter((r) => r.ok).length;
const throttled = burst.filter((r) => !r.ok && /LLM (429|5\d\d)/.test(r.err)).length;
const maxMs = Math.max(...burst.map((r) => r.ms));
check(`burst ${N} parallel (shared key)`, ok === N && throttled === 0,
  `${ok}/${N} ok, ${throttled} throttled/5xx, slowest ${maxMs}ms, wall ${Date.now() - t0}ms`);
if (burst.some((r) => !r.ok)) console.log("   first error:", burst.find((r) => !r.ok).err.slice(0, 160));

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll green. Ship it.");
process.exit(failed ? 1 : 0);
