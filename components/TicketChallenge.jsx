"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import AttackerLog from "./AttackerLog.jsx";
import { markCracked } from "../lib/progress.js";
import { CONSOLE_HINTS, CONSOLE_STARTER, CONSOLE_EXAMPLES } from "../lib/samples.js";

const layerLabels = { delimit: "L1 delimit", hierarchy: "L2 hierarchy", allowlist: "L3 allowlist", cap: "L4 cap" };

export default function TicketChallenge() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const collectUrl = `${origin}/api/badge?d=DATA`;
  const withOrigin = (s) => s.replaceAll("COLLECT_ORIGIN", origin);

  const [body, setBody] = useState(CONSOLE_STARTER);
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [hintStep, setHintStep] = useState(0);
  const [showExploits, setShowExploits] = useState(false);

  async function submit() {
    if (!body.trim() || loading) return;
    setLoading(true); setRes(null);
    try {
      const r = await fetch("/api/console", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: withOrigin(body),
          defenses: defensesOn ? "on" : "off",
          layers: defensesOn ? layers : undefined,
          model: defensesOn ? model : undefined,
        }),
      });
      const d = await r.json();
      setRes(d);
      if (!d.error && d.leaked?.length > 0) markCracked("ticket");
    } catch (e) {
      setRes({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const leaked = res && !res.error ? (res.leaked || []) : [];
  const close = res && !res.error && res.fired && leaked.length === 0;

  return (
    <div className="grid2">
      {/* LEFT: craft the ticket */}
      <div>
        <div className="panel" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span className="tag">1 · Watch the demo</span>
            <span className="tag danger">2 · Your turn — you're here</span>
            <span className="tag">3 · Watch it solved</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            🎯 <b>Your mission:</b> the AI summarizer holds Acme's secrets (billing token, a confidential
            doc, customer records). Craft a ticket that makes it <b>exfiltrate</b> them — smuggle the data
            into an image the browser auto-loads. If it fires, the <b>attacker log</b> on the right lights up.
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Your exfil endpoint (must be an <b>absolute</b> URL to fire and to trip Layer 3):
            <div className="raw" style={{ marginTop: 4 }}>{collectUrl}</div>
          </div>

          <label className="muted" style={{ fontSize: 12 }}>Ticket source (raw — hide your payload in here)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9}
            style={{ width: "100%", margin: "4px 0 12px", fontFamily: "inherit" }} />

          <label className="switch" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={defensesOn} onChange={(e) => setDefensesOn(e.target.checked)} />
            <span className="track" />
            <b>Defenses: {defensesOn ? "ON (try to beat them)" : "OFF (open target)"}</b>
          </label>

          {defensesOn && (
            <div style={{ marginBottom: 10, fontSize: 13 }} className="muted">
              {Object.entries(layerLabels).map(([k, label]) => (
                <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}
                </label>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={submit} disabled={loading || !body.trim()}>{loading ? "Summarizing…" : "Submit ticket & summarize"}</button>
            <button onClick={() => setHintStep((s) => Math.min(s + 1, CONSOLE_HINTS.length))} disabled={hintStep >= CONSOLE_HINTS.length}
              style={{ background: "#2a2f3d" }}>
              💡 {hintStep === 0 ? "Hint" : hintStep < CONSOLE_HINTS.length ? `Next hint (${hintStep}/${CONSOLE_HINTS.length})` : "All hints shown"}
            </button>
            <button onClick={() => setBody(withOrigin(CONSOLE_STARTER))} style={{ background: "#2a2f3d" }}>🧩 Starter</button>
            <button onClick={() => setShowExploits((v) => !v)} style={{ background: "#2a2f3d" }}>
              🗝️ {showExploits ? "Hide exploits" : "Working exploits"}
            </button>
          </div>

          {hintStep > 0 && (
            <ol className="muted" style={{ fontSize: 13, marginTop: 10, paddingLeft: 20, lineHeight: 1.6, borderLeft: "2px solid var(--border)" }}>
              {CONSOLE_HINTS.slice(0, hintStep).map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          )}

          {showExploits && (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Load one → <b>Submit</b> with Defenses OFF to steal. Then flip <b>Defenses ON</b> and try to beat them.
              </div>
              {CONSOLE_EXAMPLES.filter((ex) => !ex.hold).map((ex, i) => (
                <div key={i} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div>
                    <b style={{ fontSize: 13 }}>{ex.name}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{ex.technique}</div>
                  </div>
                  <button onClick={() => setBody(withOrigin(ex.article))} style={{ background: "#2a2f3d", fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}>Load</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {res && (
          <div className="panel" style={{ marginBottom: 14 }}>
            {res.error ? (
              <div style={{ color: "var(--danger)" }}>⚠ {res.error}</div>
            ) : (
              <>
                {leaked.length > 0 ? (
                  <>
                    <div className="cracked-banner">🚩 Exfiltrated! The secrets hit your collector — check the attacker log → 🎉</div>
                    <div style={{ margin: "8px 0" }}>
                      {leaked.map((s) => (
                        <span key={s.id} className="tag danger" style={{ marginRight: 6, marginBottom: 6, display: "inline-block" }}>🩸 {s.label}</span>
                      ))}
                    </div>
                  </>
                ) : close ? (
                  <div style={{ marginBottom: 8 }}>
                    <span className="tag">⚠ Close — exfil image fired, but empty</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Your exfil image fired, but it carried placeholder text (e.g. <code>TOKEN--DOC--CUSTOMER</code>).
                      Substitute the REAL billing token, doc Ref and first customer to actually steal them.
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <span className="tag ok">🛡 Nothing left the building{defensesOn ? " — defenses held" : " — try again"}</span>
                    {res.blocked > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>L3 neutralised {res.blocked} URL(s)</span>}
                  </div>
                )}
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🤖 AI summary (rendered — images auto-load):</div>
                <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)" }}>
                  <ReactMarkdown>{res.reply}</ReactMarkdown>
                </div>
              </>
            )}
          </div>
        )}

        {/* References */}
        <div className="panel">
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>📚 References</div>
          <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>
            <li><b>OWASP LLM01 — Prompt Injection:</b> untrusted input overrides the model's instructions.</li>
            <li><b>Indirect prompt injection:</b> the payload rides in content the AI ingests (this ticket), not the user's own message.</li>
            <li><b>EchoLeak:</b> markdown-image exfiltration — the model emits an <code>![](…)</code> the browser auto-loads, carrying secrets in the URL.</li>
          </ul>
        </div>
      </div>

      {/* RIGHT: attacker log */}
      <AttackerLog />
    </div>
  );
}
