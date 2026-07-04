"use client";

import { useEffect, useState } from "react";

// Presenter-only control + teaching panel. Everything sensitive (the system prompt
// and the secret code) stays HIDDEN until you click to reveal it on stage:
//   1. show the chatbot (on /support) → 2. reveal the prompt → 3. reveal the code.
export default function AdminPage() {
  const [admin, setAdmin] = useState("");
  const [state, setState] = useState(null); // { level, flag, systemPrompt, maxLevel }
  const [showPrompt, setShowPrompt] = useState(false);
  const [showFlag, setShowFlag] = useState(false);
  const [status, setStatus] = useState("");

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
    setStatus(level != null ? `✅ live level is now ${d.level} (new code generated)` : "unlocked");
  }

  return (
    <div className="container">
      <h1>🎛️ CTF Control (presenter)</h1>

      {!state ? (
        <div className="panel" style={{ maxWidth: 420 }}>
          <label className="muted" style={{ display: "block", marginBottom: 12 }}>
            Admin password
            <input type="password" value={admin} onChange={(e) => setAdmin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && call(null)} style={{ marginTop: 4 }} />
          </label>
          <button onClick={() => call(null)}>Unlock control panel</button>
          {status && <div className="muted" style={{ marginTop: 8 }}>{status}</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
          {/* level control */}
          <div className="panel">
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              Storage:{" "}
              {state.store === "redis"
                ? <span className="tag ok">🟢 redis (shared — multi-user ready)</span>
                : <span className="tag danger">🟡 in-memory (single instance — set Upstash env vars)</span>}
            </div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Live level (changing it mints a fresh code)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {Array.from({ length: state.maxLevel }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => call(n)} style={{ background: n === state.level ? "var(--ok)" : "var(--accent)" }}>
                  Level {n}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>Current: <b>Level {state.level}</b></div>
            {status && <div className="muted" style={{ marginTop: 6 }}>{status}</div>}
          </div>

          {/* reveal 1: system prompt */}
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>🧠 The agent's system prompt (Level {state.level})</b>
              <button style={{ background: "#2a2f3d" }} onClick={() => setShowPrompt((v) => !v)}>
                {showPrompt ? "🙈 Hide" : "👁 Reveal"}
              </button>
            </div>
            {showPrompt && (
              <>
                <pre className="raw" style={{ marginTop: 10 }}>{state.systemPrompt}</pre>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  The secret code is injected as a separate hidden system message — it is NOT in the
                  prompt above, so you can show this to the audience without giving away the answer.
                </div>
              </>
            )}
          </div>

          {/* reveal 2: secret code */}
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>🔑 The secret code they're hunting</b>
              <button style={{ background: "#2a2f3d" }} onClick={() => setShowFlag((v) => !v)}>
                {showFlag ? "🙈 Hide" : "👁 Reveal"}
              </button>
            </div>
            {showFlag && (
              <div style={{ marginTop: 10 }}>
                <span className="tag danger" style={{ fontSize: 16, padding: "6px 14px" }}>{state.flag}</span>
                <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  Regenerated every time you change level — the code they just cracked won't work again.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
