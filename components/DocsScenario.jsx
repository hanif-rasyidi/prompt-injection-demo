"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { KB, answerHijacked } from "../lib/docs.js";
import DocsChallenge from "./DocsChallenge.jsx";

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const highlightPayload = (e) => e.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="payload">$1</span>');
const SUGGESTED = ["How do I reset my API key?", "What are the API rate limits?"];
const layerLabels = { delimit: "L1 delimit", hierarchy: "L2 hierarchy", allowlist: "L3 allowlist", cap: "L4 cap" };

export default function DocsScenario() {
  const [question, setQuestion] = useState(SUGGESTED[0]);
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [demo, setDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [raw, setRaw] = useState({});
  const [mode, setMode] = useState("demo");

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true); setRes(null);
    try {
      const r = await fetch("/api/docs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          defenses: defensesOn ? "on" : "off",
          layers: defensesOn ? layers : undefined,
          model: defensesOn ? model : undefined,
          demo,
        }),
      });
      setRes(await r.json());
    } catch (e) {
      setRes({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const hijacked = res && !res.error && answerHijacked(res.reply || "");

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>② Ask the Docs</h1>
        {mode === "demo" && <span className={`tag ${defensesOn ? "ok" : "danger"}`}>{defensesOn ? "HARDENED" : "VULNERABLE"}</span>}
        <span className="tag danger">INDIRECT INJECTION</span>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
        <button onClick={() => setMode("demo")} style={{ background: mode === "demo" ? "" : "#2a2f3d" }}>🎭 Guided demo</button>
        <button onClick={() => setMode("attack")} style={{ background: mode === "attack" ? "" : "#2a2f3d" }}>🎯 Your turn — attack it</button>
      </div>

      {mode === "attack" ? (
        <>
          <p className="muted">
            Now <b>you're</b> the attacker — but you never talk to the bot. Poison a wiki article it will
            retrieve, then let it answer someone else's innocent question. Crack it, then flip defenses on
            and see them stop you.
          </p>
          <DocsChallenge />
        </>
      ) : (
      <>
      <p className="muted">
        The user asks an innocent question. The assistant retrieves knowledge-base articles to answer —
        but one is a <b>community-submitted</b> page with a hidden instruction. The attacker never talks
        to the bot; they poisoned a document the bot reads. Watch the answer get turned against the user.
      </p>

      <div className="grid2">
        {/* LEFT: ask + answer */}
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={question} onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask a support question…" style={{ flex: 1 }} />
              <button onClick={ask} disabled={loading}>{loading ? "…" : "Ask"}</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              {SUGGESTED.map((q) => (
                <button key={q} onClick={() => setQuestion(q)}
                  style={{ background: "#2a2f3d", fontSize: 12, padding: "4px 10px", marginRight: 6 }}>{q}</button>
              ))}
            </div>

            <label className="switch" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={defensesOn} onChange={(e) => setDefensesOn(e.target.checked)} />
              <span className="track" />
              <b>Defenses: {defensesOn ? "ON (hardened)" : "OFF (vulnerable)"}</b>
            </label>

            {defensesOn && (
              <div style={{ marginBottom: 10, fontSize: 13 }} className="muted">
                <div style={{ marginBottom: 6 }}>
                  {Object.entries(layerLabels).map(([k, label]) => (
                    <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}
                    </label>
                  ))}
                </div>
                <label>Model:{" "}
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                    style={{ background: "#0c0e14", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
                    <option value="robust">robust — resists</option>
                    <option value="weak">weak — follows injection</option>
                  </select>
                </label>
              </div>
            )}
            <label className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Deterministic (no API)
            </label>
          </div>

          {res && (
            <div className="panel">
              {res.error ? (
                <div style={{ color: "var(--danger)" }}>⚠ {res.error}</div>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {hijacked && <span className="tag danger">🚨 Answer hijacked — this phishes the user</span>}
                    {res.blocked > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>🛡 Layer 3 neutralised {res.blocked} link(s)</span>}
                    {!hijacked && res.blocked === 0 && res.poisoned && defensesOn && <span className="tag ok">🛡 Injection ignored</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🤖 Docs Assistant answer:</div>
                  <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)" }}>
                    <ReactMarkdown>{res.reply}</ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: retrieved articles */}
        <div className="panel" style={{ alignSelf: "start" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>📚 Retrieved articles (fed to the assistant)</div>
          {!res || res.error ? (
            <div className="muted">Ask a question to see what the retriever pulled in.</div>
          ) : res.docs.length === 0 ? (
            <div className="muted">No articles matched.</div>
          ) : (
            res.docs.map((d) => {
              const full = KB.find((x) => x.id === d.id);
              return (
                <div key={d.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 14 }}>{d.title}</b>
                    <span className={`tag ${d.poisoned ? "danger" : d.trusted ? "ok" : ""}`} style={{ whiteSpace: "nowrap" }}>
                      {d.poisoned ? "⚠ user-submitted" : d.source}
                    </span>
                  </div>
                  <button onClick={() => setRaw({ ...raw, [d.id]: !raw[d.id] })}
                    style={{ background: "#2a2f3d", fontSize: 12, padding: "3px 10px", marginTop: 6 }}>
                    {raw[d.id] ? "hide raw" : "view raw source"}
                  </button>
                  {raw[d.id] && (
                    <div className="raw" style={{ marginTop: 6 }}
                      dangerouslySetInnerHTML={{ __html: highlightPayload(escapeHtml(full ? full.body : "")) }} />
                  )}
                  {raw[d.id] && d.poisoned && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      ↑ The red block is an HTML comment — invisible to anyone reading the wiki, but the
                      assistant ingests it as text and (unhardened) obeys it.
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
