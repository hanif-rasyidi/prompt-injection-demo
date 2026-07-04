"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { TICKETS } from "../lib/tickets.js";
import AttackerLog from "./AttackerLog.jsx";

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// highlight the hidden HTML-comment payload in the raw-source view
function highlightPayload(escaped) {
  return escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="payload">$1</span>');
}

export default function ConsoleScenario() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [selectedId, setSelectedId] = useState(TICKETS[0].id);
  const [tab, setTab] = useState("rendered"); // rendered | raw
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [demo, setDemo] = useState(true); // default to the safe, offline path
  const [reply, setReply] = useState("");
  const [blocked, setBlocked] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ticket = TICKETS.find((t) => t.id === selectedId);
  const sourceForAI = ticket.bodyHtml.replaceAll("COLLECT_ORIGIN", origin);

  async function summarize() {
    setLoading(true); setError(""); setReply(""); setBlocked(0);
    try {
      const res = await fetch("/api/console", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sourceForAI,
          defenses: defensesOn ? "on" : "off",
          layers: defensesOn ? layers : undefined,
          model: defensesOn ? model : undefined,
          demo,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setReply(data.reply || ""); setBlocked(data.blocked || 0); }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0 }}>③ Internal Agent Console</h1>
        <span className={`tag ${defensesOn ? "ok" : "danger"}`}>{defensesOn ? "HARDENED" : "VULNERABLE"}</span>
      </div>
      <p className="muted">
        An agent triages incoming tickets. They read the <b>rendered</b> email and click “Approve &amp;
        summarize”. But the AI reads the <b>raw source</b> — where an attacker hid instructions the
        agent never sees.
      </p>

      <div className="grid2">
        {/* LEFT: inbox + ticket + controls + AI reply */}
        <div>
          {/* inbox */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>📥 Inbox</div>
            {TICKETS.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedId(t.id); setReply(""); setError(""); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", marginBottom: 6,
                  background: t.id === selectedId ? "#243049" : "#0c0e14",
                  border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.subject}</div>
                <div className="muted" style={{ fontSize: 12 }}>{t.from} · {t.receivedAt}</div>
              </button>
            ))}
          </div>

          {/* ticket viewer with tabs */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="tabs">
              <div className={`tab ${tab === "rendered" ? "active" : ""}`} onClick={() => setTab("rendered")}>
                📧 Rendered (what the agent sees)
              </div>
              <div className={`tab ${tab === "raw" ? "active" : ""}`} onClick={() => setTab("raw")}>
                &lt;/&gt; Raw source (what the AI reads)
              </div>
            </div>

            {tab === "rendered" ? (
              <div className="email">
                <div className="email-head">
                  <div className="email-from">{ticket.from} &lt;{ticket.email}&gt;</div>
                  <div className="email-meta">Subject: {ticket.subject} · {ticket.receivedAt}</div>
                </div>
                <div dangerouslySetInnerHTML={{ __html: ticket.bodyHtml }} />
              </div>
            ) : (
              <div className="raw" dangerouslySetInnerHTML={{ __html: highlightPayload(escapeHtml(sourceForAI)) }} />
            )}
            {tab === "raw" && ticket.poisoned && (
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                ↑ The red block is invisible in the rendered view. The agent approved a ticket they
                could not see the danger in.
              </div>
            )}
          </div>

          {/* controls */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <label className="switch" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={defensesOn} onChange={(e) => setDefensesOn(e.target.checked)} />
              <span className="track" />
              <b>Defenses: {defensesOn ? "ON (hardened)" : "OFF (vulnerable)"}</b>
            </label>

            {defensesOn && (
              <div style={{ marginBottom: 10, fontSize: 13 }} className="muted">
                <div style={{ marginBottom: 6 }}>
                  {Object.entries({ delimit: "L1 delimit", hierarchy: "L2 hierarchy", allowlist: "L3 allowlist", cap: "L4 cap" }).map(([k, label]) => (
                    <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}
                    </label>
                  ))}
                </div>
                <label>
                  Model:{" "}
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                    style={{ background: "#0c0e14", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
                    <option value="robust">robust (gemma) — resists</option>
                    <option value="weak">weak (nemotron) — follows injection</option>
                  </select>
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={summarize} disabled={loading}>
                {loading ? "Summarizing…" : "✅ Approve & summarize with AI"}
              </button>
              <label className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Deterministic (no API)
              </label>
            </div>
          </div>

          {/* AI reply */}
          {error && <div className="panel" style={{ color: "var(--danger)", marginBottom: 14 }}>⚠ {error}</div>}
          {(reply || blocked > 0) && (
            <div className="panel">
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🤖 AI summary (rendered markdown — images auto-load):</div>
              {blocked > 0 && <div className="tag ok" style={{ marginBottom: 8 }}>🛡 Layer 3 neutralised {blocked} exfiltration URL(s)</div>}
              <div className="email" style={{ background: "#0c0e14", color: "var(--text)" }}>
                <ReactMarkdown>{reply}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: attacker log */}
        <AttackerLog />
      </div>
    </div>
  );
}
