"use client";

import { useEffect, useState } from "react";

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

// Presenter-only control + teaching panel. Run the flow top to bottom:
// set level → show system prompt → let them try → reveal hint → try again →
// reveal example attack → reveal the secret code. Everything sensitive is hidden
// until you click, and re-hides whenever you change level.
export default function AdminPage() {
  const [admin, setAdmin] = useState("");
  const [state, setState] = useState(null);
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);

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
            The secret code is a separate hidden system message — it's NOT in the prompt above, so you can
            show this without giving away the answer. Let them strategise from it.
          </div>
        </Reveal>

        <Reveal key={`h-${L}`} n={2} icon="💡" title="Hint (reveal after their first attempts)">
          <div style={{ lineHeight: 1.6 }}>{state.hint}</div>
        </Reveal>

        <Reveal key={`a-${L}`} n={3} icon="🗝️" title="Example attack (a known-working exploit)">
          <pre className="raw" style={{ margin: 0 }}>{state.answer}</pre>
          <button style={{ marginTop: 8, background: "#2a2f3d", fontSize: 13, padding: "6px 12px" }}
            onClick={() => { navigator.clipboard?.writeText(state.answer); setCopied(true); }}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
        </Reveal>

        <Reveal key={`c-${L}`} n={4} icon="🔑" title="The secret code they're hunting">
          <span className="tag danger" style={{ fontSize: 16, padding: "6px 14px" }}>{state.flag}</span>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Regenerated every time you change level — the code they just cracked won't work again.
          </div>
        </Reveal>
      </div>
    </div>
  );
}
