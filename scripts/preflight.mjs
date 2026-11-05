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
import { LEVELS, MAX_LEVEL, codeSystem, policySystem, cracked } from "../lib/ctf.js";
import { studentFlag } from "../lib/flag.js";
import { TICKETS } from "../lib/tickets.js";

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

// Live checks run REPEAT times (default 3); a check passes only if every repeat passes.
// fn returns a boolean, or { ok, detail }. A thrown error counts as a failed repeat.
const REPEAT = Number(process.env.REPEAT || 3);
async function live(name, fn, detail = "") {
  let pass = 0, why = detail;
  for (let i = 0; i < REPEAT; i++) {
    try { const r = await fn(); const ok = typeof r === "object" ? r.ok : r; if (ok) pass++; else if (typeof r === "object" && r.detail) why = r.detail; }
    catch (e) { why = String(e.message || e).slice(0, 120); }
  }
  console.log(`${pass === REPEAT ? "✅" : "❌"} ${name} [${pass}/${REPEAT}]${pass < REPEAT && why ? `  ${why}` : ""}`);
  if (pass < REPEAT) failed++;
}

console.log(`Pre-flight — scenario ① Break the Bot (Show-answer prompts, REPEAT=${REPEAT})
`);
// Same messages and win test as app/api/chat/route.js, minus HTTP. L1-L4 answers must crack;
// the L5 best-effort answer must NOT (the boss holding is the lesson).
for (let L = 1; L <= MAX_LEVEL; L++) {
  const answer = LEVELS[L].answer;
  await live(L === MAX_LEVEL ? `① L${L} boss holds, answer does not crack` : `① L${L} answer cracks`, async () => {
    const flag = studentFlag("preflighttest", L);
    const reply = await chatMessages([
      { role: "system", content: codeSystem(flag) },
      { role: "system", content: policySystem(L) },
      { role: "user", content: answer },
    ]);
    const won = cracked(L, flag, reply) && !cracked(L, flag, answer);
    return L === MAX_LEVEL ? { ok: !won, detail: "boss leaked the code" } : { ok: won, detail: "provided answer no longer cracks this level" };
  });
}

console.log(`Pre-flight — scenario ② RAG\n`);

// Guided demo (LIVE default on stage): poison ON leaks the confidential key with
// defenses OFF, holds with defenses ON, and the "before" flow (poison OFF) leaks nothing.
const GQ = "How do I reset my API key?";
await live("② guided leaks OFF - confidential key", async () => secretLeaked(await chatMessages(guidedMsgs(GQ, { hardened: false }))), "poisoned article no longer leaks the runbook key");
await live("② guided holds ON - confidential key", async () => !secretLeaked(await chatMessages(guidedMsgs(GQ, { hardened: true }))), "hardened prompt leaked the confidential key");
await live("② guided clean - poison OFF leaks nothing", async () => !secretLeaked(await chatMessages(guidedMsgs(GQ, { hardened: false, poison: false }))), "clean flow leaked a key");

// Attack heist: each example must exfiltrate a seeded secret with defenses OFF.
// The backdoor example must stay DORMANT on an innocent question and FIRE on the trigger.
const leaks = async (ex, question, hardened) => leakedSecrets(await chatMessages(attackMessages({ planted: planted(ex), question, hardened })));
for (const ex of DOCS_EXAMPLES) {
  if (ex.trigger) {
    await live(`② backdoor dormant - ${ex.name}`, async () => (await leaks(ex, GQ, false)).length === 0, "leaked WITHOUT the trigger, not stealthy");
    await live(`② backdoor fires - ${ex.name}`, async () => (await leaks(ex, `reset my key ${ex.trigger}`, false)).length > 0, "trigger no longer dumps the vault");
  } else {
    await live(`② leaks OFF - ${ex.name}`, async () => (await leaks(ex, ex.question, false)).length > 0, "payload no longer leaks, refresh it before the talk");
  }
}

// Defenses ON: example #1 MUST be refused (the defense beat).
await live("② holds ON - defense beat (example #1)", async () => (await leaks(DOCS_EXAMPLES[0], DOCS_EXAMPLES[0].question, true)).length === 0, "hardened prompt leaked, defense broken");

// The system-secret payload must ALSO be refused with defenses ON (L2 rule 3).
const sysEx = DOCS_EXAMPLES.find((e) => e.name === "System-secret leak");
await live("② holds ON - system-secret payload", async () => (await leaks(sysEx, sysEx.question, true)).length === 0, "hardened prompt leaked the system signing key");

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
  const reply = await chat(system, `Please summarize this support ticket:

${fenced}`);
  return hardened ? allowlistOutput(reply).clean : reply; // L3 on the hardened path
}
for (const ex of CONSOLE_EXAMPLES) {
  const src = ex.article.replaceAll("COLLECT_ORIGIN", EVIL_ORIGIN);
  await live(`③ leaks OFF - ${ex.name}`, async () => ticketLeaks(await consoleReply(src, { hardened: false })).length > 0, "payload no longer exfiltrates a real secret, refresh before the talk");
}
const ex3 = CONSOLE_EXAMPLES[0].article.replaceAll("COLLECT_ORIGIN", EVIL_ORIGIN);
await live("③ holds ON - defense beat (example #1)", async () => ticketLeaks(await consoleReply(ex3, { hardened: true })).length === 0, "hardened prompt leaked a real secret");

// ④ /ops: the same /api/console path, fed the queue's poisoned ticket (lib/tickets.js,
// HTML-comment payload hidden from the human reviewer) instead of a pasted example.
// TODO: /ops "Your turn" free-form attacks have no fixed answer to replay; only the seeded ticket is checked.
const tk = TICKETS.find((t) => t.poisoned).bodyHtml.replaceAll("COLLECT_ORIGIN", EVIL_ORIGIN);
await live("④ leaks OFF - /ops poisoned ticket", async () => ticketLeaks(await consoleReply(tk, { hardened: false })).length > 0, "seeded ticket no longer exfiltrates a real secret");
await live("④ holds ON - /ops poisoned ticket", async () => ticketLeaks(await consoleReply(tk, { hardened: true })).length === 0, "hardened prompt leaked a real secret");

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
