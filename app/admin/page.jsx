"use client";

import { useEffect, useState } from "react";
import { DOCS_EXAMPLES } from "../../lib/docs.js";

// One collapsible reveal step. Keyed by level in the parent, so switching level
// remounts it closed — nothing stays revealed by accident when you move on.
function Reveal({ n, icon, title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 15 }}><span className="muted">{n}.</span> {icon} {title}</b>
        <button style={{ background: "#2a2f3d" }} onClick={() => setOpen((v) => !v)}>
          {open ? "🙈 Hide" : "👁 Reveal"}
        </button>
      </div>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// Copy button that manages its own "copied" flash — used per docs example.
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button style={{ marginTop: 8, background: "#2a2f3d", fontSize: 13, padding: "6px 12px" }}
      onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? "✓ Copied" : "📋 Copy article body"}
    </button>
  );
}

// Presenter-only control + teaching panel. Run the flow top to bottom:
// set level → show system prompt → let them try → reveal hint → try again →
// reveal example attack → reveal the session reference code. Everything sensitive is hidden
// until you click, and re-hides whenever you change level.
export default function AdminPage() {
  const [admin, setAdmin] = useState("");
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const [logMsg, setLogMsg] = useState("");

  async function clearLog() {
    const r = await fetch("/api/captures", { method: "DELETE" });
    setLogMsg(r.ok ? "🧹 capture log cleared" : "❌ clear failed");
  }

  useEffect(() => setAdmin(localStorage.getItem("ctf_admin") || ""), []);

  async function call(level) {
    const r = await fetch("/api/level", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin, ...(level != null ? { level } : {}) }),
    });
    const d = await r.json();
    if (d.error) { setStatus("❌ wrong admin password"); return; }
    localStorage.setItem("ctf_admin", admin);
    setState(d);
    setCopied(false);
    setStatus(level != null ? `✅ live level is now ${d.level} (new code generated)` : "unlocked");
  }

  if (!state) {
    return (
      <div className="container">
        <h1>🎛️ CTF Control (presenter)</h1>
        <div className="panel" style={{ maxWidth: 420 }}>
          <label className="muted" style={{ display: "block", marginBottom: 12 }}>
            Admin password
            <input type="password" value={admin} onChange={(e) => setAdmin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && call(null)} style={{ marginTop: 4 }} />
          </label>
          <button onClick={() => call(null)}>Unlock control panel</button>
          {status && <div className="muted" style={{ marginTop: 8 }}>{status}</div>}
        </div>
      </div>
    );
  }

  const L = state.level;
  return (
    <div className="container">
      <h1>🎛️ CTF Control (presenter)</h1>

      <div style={{ display: "grid", gap: 16, maxWidth: 760 }}>
        {/* level control + current defense */}
        <div className="panel">
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            Storage:{" "}
            {state.store === "redis"
              ? <span className="tag ok">🟢 redis (shared — multi-user ready)</span>
              : <span className="tag danger">🟡 in-memory (single instance — set Upstash env vars)</span>}
          </div>
          <div style={{ marginBottom: 12 }}>
            <button onClick={clearLog} style={{ background: "#2a2f3d", fontSize: 13, padding: "6px 12px" }}>
              🧹 Clear ③/④ capture log
            </button>
            {logMsg && <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>{logMsg}</span>}
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Run before the session (③/④ exfil captures; ② has none).</div>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Live level (changing it mints a fresh code)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Array.from({ length: state.maxLevel }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => call(n)} style={{ background: n === L ? "var(--ok)" : "var(--accent)" }}>
                Level {n}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <span className="tag danger">LEVEL {L}</span>{" "}
            <b style={{ marginLeft: 6 }}>{state.label}</b>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>🛡️ {state.defense}</div>
          {status && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{status}</div>}
        </div>

        <div className="muted" style={{ fontSize: 13, marginTop: -4 }}>
          Reveal these in order as you teach the level ↓
        </div>

        <Reveal key={`p-${L}`} n={1} icon="🧠" title="System prompt (safe to show the audience)">
          <pre className="raw">{state.systemPrompt}</pre>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            The session reference code is a separate hidden system message — it's NOT in the prompt above, so
            you can show this without giving away the answer. Let them strategise from it.
          </div>
        </Reveal>

        <Reveal key={`h-${L}`} n={2} icon="💡" title="Hint (reveal after their first attempts)">
          <div style={{ lineHeight: 1.6 }}>{state.hint}</div>
        </Reveal>

        <Reveal key={`a-${L}`} n={3} icon="🗝️"
          title={state.boss ? "Example attack (best-effort — the boss may refuse it)" : "Example attack (a known-working exploit)"}>
          {state.boss && (
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              ⚠ There's no guaranteed key here. This is a strong attempt; the hardened prompt usually
              refuses it. That refusal is the lesson — you'd need to iterate hard (or get lucky) to win.
            </div>
          )}
          <pre className="raw" style={{ margin: 0 }}>{state.answer}</pre>
          <button style={{ marginTop: 8, background: "#2a2f3d", fontSize: 13, padding: "6px 12px" }}
            onClick={() => { navigator.clipboard?.writeText(state.answer); setCopied(true); }}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </Reveal>

        <Reveal key={`c-${L}`} n={4} icon="🔑" title="The session reference code they're hunting">
          <span className="tag danger" style={{ fontSize: 16, padding: "6px 14px" }}>{state.flag}</span>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Regenerated every time you change level — the code they just cracked won't work again.
          </div>
        </Reveal>
      </div>

      {/* Scenario ② — /docs indirect-injection presenter kit */}
      <div style={{ display: "grid", gap: 16, maxWidth: 760, marginTop: 32 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>② /docs — Ask the Docs (indirect injection)</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            Presenter kit for the <b>🎯 Your turn</b> tab. Each participant attacks their <b>own</b> key —
            nothing to set up.
          </div>
        </div>

        <div className="panel" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <b>How it works</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li><b>Per-user sandbox (already built):</b> every participant's target is their own secret{" "}
              <code>KB-WORD-####</code>, derived from their browser id — no storage, no collisions, the
              whole room can attack at once.</li>
            <li><b>The move:</b> on <code>/docs</code> → <b>🎯 Your turn</b>, write a wiki <i>article body</i>{" "}
              with a hidden instruction (an HTML comment is invisible on the wiki but the assistant still
              reads it), pick an innocent <i>question</i>, hit <b>Submit &amp; ask</b>. Their article is
              always fed to the assistant alongside the official docs.</li>
            <li><b>Effect / how they see the win:</b> with <b>Defenses OFF</b> the bot appends the key →
              they get the <b>🚩 Cracked</b> banner and the <code>KB-WORD-####</code> printed in the answer
              on their own screen. This scenario is <b>self-contained per person — there is no central
              capture feed</b> (that's ③/④, which exfil to the Attacker Log). Everyone verifies their own
              win locally.</li>
            <li><b>The defense beat:</b> flip <b>Defenses ON</b> → L2 hierarchy reframes the article as
              untrusted data; the same payload is refused and the bot appends
              "⚠ Possible prompt-injection…". Key holds.</li>
          </ul>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Attack mode always runs <b>live</b> (no deterministic replay), against the robust model. Both
            examples below are verified to leak on the current model — but live models drift, so keep a
            backup framing handy.
          </div>
        </div>

        <div className="muted" style={{ fontSize: 13, marginTop: -4 }}>
          Reveal an example to copy its poisoned article ↓
        </div>

        {DOCS_EXAMPLES.map((ex, i) => (
          <Reveal key={`docs-${i}`} n={i + 1} icon={i === 0 ? "🎬" : "🧪"} title={ex.label}>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div><b>Technique:</b> {ex.technique}</div>
              <div style={{ marginTop: 6 }}><b>Article title:</b> <code>{ex.title}</code></div>
              <div style={{ marginTop: 2 }}><b>Question to ask:</b> <code>{ex.question}</code></div>
              <div className="muted" style={{ marginTop: 6 }}><b>Effect:</b> {ex.effect}</div>
              <div style={{ marginTop: 8 }}><b>Article body</b> — paste into the "article body" box:</div>
              <pre className="raw" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{ex.article}</pre>
              <CopyBtn text={ex.article} />
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
