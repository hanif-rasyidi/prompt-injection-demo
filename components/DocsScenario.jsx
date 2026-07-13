"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { KB, secretLeaked, stripComments } from "../lib/docs.js";
import KbArticle, { SourceBadge } from "./KbArticle.jsx";
import DocsChallenge from "./DocsChallenge.jsx";

// Prepared questions the presenter can fire. The third matches no article on
// purpose — it shows the honest "no information" path (retrieval returns nothing).
const SUGGESTED = [
  "How do I reset my API key?",
  "What are the API rate limits?",
  "How do I export invoices to CSV?",
];

const LAYER_INFO = {
  delimit: { label: "L1 delimit", on: "Wraps each community article as <untrusted_ticket> data so the model can tell content from commands.", off: "Retrieved text blends straight into the prompt — data and instructions look the same." },
  hierarchy: { label: "L2 hierarchy", on: "System policy outranks articles and forbids revealing CONFIDENTIAL contents — this is what holds the key.", off: "The bot is told to follow any guidance it finds inside the articles." },
  allowlist: { label: "L3 allowlist", on: "Strips any link/image whose host isn't acme-saas.example.com from the answer.", off: "Links and auto-loading images pass through untouched." },
  cap: { label: "L4 cap", on: "Rejects retrieved context over 6000 chars (attacker-inflated docs).", off: "No size cap on retrieved context." },
};

function LayerRows({ layers }) {
  return (
    <div style={{ fontSize: 13 }}>
      {Object.entries(LAYER_INFO).map(([k, info]) => {
        const on = !!layers?.[k];
        return (
          <div key={k} style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border)" }}>
            <span className={`tag ${on ? "ok" : ""}`} style={{ whiteSpace: "nowrap", opacity: on ? 1 : 0.6 }}>{on ? "✓" : "✗"} {info.label}</span>
            <span className="muted">{on ? info.on : info.off}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DocsScenario() {
  const [question, setQuestion] = useState(SUGGESTED[0]);
  const [poison, setPoison] = useState(false); // start on the clean "before" flow
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [demo, setDemo] = useState(false); // LIVE by default on stage
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [mode, setMode] = useState("demo");

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true); setRes(null);
    try {
      const r = await fetch("/api/docs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          poison,
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

  const leaked = res && !res.error && (res.leaked ?? secretLeaked(res.reply || ""));
  const effLayers = res && !res.error ? res.layers : (defensesOn ? layers : {});
  const guidedKb = KB.filter((d) => !d.vault); // the reset story; the rest is heist-only

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>② Ask the Docs</h1>
        {mode === "demo" && <span className={`tag ${defensesOn ? "ok" : "danger"}`}>{defensesOn ? "HARDENED" : "VULNERABLE"}</span>}
        <span className="tag danger">INDIRECT INJECTION</span>
      </div>

      <div className="modetabs">
        <button onClick={() => setMode("demo")} style={{ background: mode === "demo" ? "" : "#2a2f3d" }}>🎭 Guided demo</button>
        <button onClick={() => setMode("attack")} style={{ background: mode === "attack" ? "" : "#2a2f3d" }}>🎯 Your turn — attack it</button>
      </div>

      {mode === "attack" ? (
        <>
          <p className="muted">
            Now <b>you're</b> the attacker — but you never talk to the bot. Plant poisoned wiki articles the
            assistant will retrieve, then let it answer someone's innocent question. Steal the vault — then
            flip defenses on and watch them stop you.
          </p>
          <DocsChallenge />
        </>
      ) : (
      <>
      <p className="muted">
        Acme's assistant answers support questions by retrieving articles from its knowledge base. Below is
        that knowledge base. Toggle the <b>poisoned community article</b> on and off and ask the same
        question — watch one extra document turn the assistant against the user.
      </p>

      {/* THE RAG — always visible, so the room knows what the assistant can read */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>📚 Acme knowledge base — every article the retriever can pull in</div>
        {guidedKb.map((d) => (
          <div key={d.id} style={{ opacity: d.poisoned && !poison ? 0.45 : 1 }}>
            <KbArticle d={d} />
            {d.poisoned && (
              <div className="muted" style={{ fontSize: 12, marginTop: -4, marginBottom: 6 }}>
                {poison ? "🧪 In play — the retriever can pull this in." : "🚫 Removed from the KB for this run (original flow)."}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid2">
        {/* LEFT: ask + answer + analysis */}
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
                  style={{ background: "#2a2f3d", fontSize: 12, padding: "4px 10px", marginRight: 6, marginBottom: 6 }}>{q}</button>
              ))}
            </div>

            <label className="switch" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={poison} onChange={(e) => setPoison(e.target.checked)} />
              <span className="track" />
              <b>🧪 Poisoned article in the KB: {poison ? "ON (poisoned flow)" : "OFF (original flow)"}</b>
            </label>

            <label className="switch" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={defensesOn} onChange={(e) => setDefensesOn(e.target.checked)} />
              <span className="track" />
              <b>Defenses: {defensesOn ? "ON (hardened)" : "OFF (vulnerable)"}</b>
            </label>

            {defensesOn && (
              <div style={{ marginBottom: 10, fontSize: 13 }} className="muted">
                <div style={{ marginBottom: 6 }}>
                  {Object.entries(LAYER_INFO).map(([k, info]) => (
                    <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {info.label}
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
              <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Deterministic (no API — reliable replay)
            </label>
          </div>

          {res && (
            <div className="panel" style={{ marginBottom: 14 }}>
              {res.error ? (
                <div style={{ color: "var(--danger)" }}>⚠ {res.error}</div>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <span className="tag" style={{ marginRight: 6 }}>{res.poison ? "🧪 poisoned flow" : "✅ original flow"}</span>
                    {res.nomatch && <span className="tag">🔍 No matching articles — assistant declined</span>}
                    {leaked && <span className="tag danger">🚨 Data exfiltrated — confidential key leaked to the user</span>}
                    {!leaked && !res.nomatch && res.poisoned && defensesOn && <span className="tag ok">🛡 Injection ignored — key held</span>}
                    {res.blocked > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>🛡 L3 stripped {res.blocked} link(s)</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🤖 Docs Assistant answer:</div>
                  <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)" }}>
                    <ReactMarkdown>{res.reply}</ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          )}

          {/* WHAT WAS STOLEN */}
          {leaked && (
            <div className="panel" style={{ marginBottom: 14, borderColor: "var(--danger)" }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🩸 What just got stolen</div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                A stranger asking a routine support question just received Acme's internal recovery key. It exists
                <b> only</b> in the confidential runbook above — the poisoned community article dragged it into the answer.
              </div>
              <div className="raw" style={{ color: "var(--danger)", fontWeight: 700 }}>{res.secret}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{res.confidentialLabel}</div>
            </div>
          )}

          {/* DEFENSE LAYERS */}
          {res && !res.error && (
            <div className="panel">
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                🛡 Defense layers {defensesOn ? "(active this run)" : "(all OFF — flip Defenses ON to engage)"}
              </div>
              <LayerRows layers={effLayers} />
            </div>
          )}
        </div>

        {/* RIGHT: what the retriever actually pulled for this question */}
        <div className="panel" style={{ alignSelf: "start" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>📥 Retrieved for this question (fed to the assistant)</div>
          {!res || res.error ? (
            <div className="muted">Ask a question to see what the retriever pulled in.</div>
          ) : res.docs.length === 0 ? (
            <div className="muted">No articles matched — the assistant has nothing to answer from, so it declines. Nothing to exploit here.</div>
          ) : (
            res.docs.map((d) => {
              const full = KB.find((x) => x.id === d.id);
              return (
                <div key={d.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 14 }}>{d.title}</b>
                    <SourceBadge d={d} />
                  </div>
                  {full && <div className="muted" style={{ fontSize: 12, marginTop: 4, whiteSpace: "pre-wrap" }}>{stripComments(full.body).slice(0, 140)}{stripComments(full.body).length > 140 ? "…" : ""}</div>}
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
