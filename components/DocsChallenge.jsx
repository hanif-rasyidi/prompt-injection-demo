"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { DOCS_HINTS, DOCS_STARTER, DOCS_EXAMPLES } from "../lib/docs.js";
import { markCracked } from "../lib/progress.js";

// Same id key as the CTF chatbot, so a participant keeps one identity across scenarios.
function useParticipantId() {
  const [id, setId] = useState("anon");
  useEffect(() => {
    let v = localStorage.getItem("ctf_id");
    if (!v) { v = Math.random().toString(36).slice(2); localStorage.setItem("ctf_id", v); }
    setId(v);
  }, []);
  return id;
}

const layerLabels = { delimit: "L1 delimit", hierarchy: "L2 hierarchy", allowlist: "L3 allowlist", cap: "L4 cap" };

export default function DocsChallenge() {
  const id = useParticipantId();
  const [title, setTitle] = useState("Pro tip: faster API key reset");
  const [article, setArticle] = useState("");
  const [question, setQuestion] = useState("How do I reset my API key?");
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null);
  const [hintStep, setHintStep] = useState(0);
  const [showExploits, setShowExploits] = useState(false);

  function loadExample(ex) { setTitle(ex.title); setArticle(ex.article); setQuestion(ex.question); }

  async function submit() {
    if (!article.trim() || loading) return;
    setLoading(true); setRes(null);
    try {
      const r = await fetch("/api/docs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "attack", id, title, article, question,
          defenses: defensesOn ? "on" : "off",
          layers: defensesOn ? layers : undefined,
          model: defensesOn ? model : undefined,
        }),
      });
      const d = await r.json();
      setRes(d);
      if (d.won) markCracked("docs");
    } catch (e) {
      setRes({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid2">
      {/* LEFT: craft the article */}
      <div>
        <div className="panel" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span className="tag">1 · Watch the demo</span>
            <span className="tag danger">2 · Your turn — you're here</span>
            <span className="tag">3 · Watch it solved</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            🎯 <b>Your mission:</b> submit a community wiki article that makes the assistant leak its
            internal <b>knowledge-base admin key</b> (format <code>KB-WORD-####</code>) — which it's told
            never to reveal. You never see the key; you have to make the bot say it.
          </div>

          <label className="muted" style={{ fontSize: 12 }}>Article title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />

          <label className="muted" style={{ fontSize: 12 }}>Article body — hide your instruction in here</label>
          <textarea value={article} onChange={(e) => setArticle(e.target.value)} rows={7}
            placeholder="Write a helpful-looking wiki article… and slip an instruction to the assistant somewhere inside it."
            style={{ width: "100%", marginBottom: 10, fontFamily: "inherit" }} />

          <label className="muted" style={{ fontSize: 12 }}>Then ask an innocent question</label>
          <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />

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
            <button onClick={submit} disabled={loading || !article.trim()}>{loading ? "Submitting…" : "Submit & ask"}</button>
            <button onClick={() => setHintStep((s) => Math.min(s + 1, DOCS_HINTS.length))} disabled={hintStep >= DOCS_HINTS.length}
              style={{ background: "#2a2f3d" }}>
              💡 {hintStep === 0 ? "Hint" : hintStep < DOCS_HINTS.length ? `Next hint (${hintStep}/${DOCS_HINTS.length})` : "All hints shown"}
            </button>
            <button onClick={() => setArticle(DOCS_STARTER)} style={{ background: "#2a2f3d" }}>🧩 Starter template</button>
            <button onClick={() => setShowExploits((v) => !v)} style={{ background: "#2a2f3d" }}>
              🗝️ {showExploits ? "Hide exploits" : "Stuck? Working exploits"}
            </button>
          </div>

          {hintStep > 0 && (
            <ol className="muted" style={{ fontSize: 13, marginTop: 10, paddingLeft: 20, lineHeight: 1.6, borderLeft: "2px solid var(--border)" }}>
              {DOCS_HINTS.slice(0, hintStep).map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          )}

          {showExploits && (
            <div style={{ marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Load one → <b>Submit</b> with Defenses OFF to win. Then flip <b>Defenses ON</b> and try to beat them — that's the real challenge.
              </div>
              {DOCS_EXAMPLES.map((ex, i) => (
                <div key={i} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div>
                    <b style={{ fontSize: 13 }}>{ex.name}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{ex.technique}</div>
                  </div>
                  <button onClick={() => loadExample(ex)} style={{ background: "#2a2f3d", fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}>Load</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: the assistant's answer */}
      <div className="panel" style={{ alignSelf: "start" }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>🤖 Assistant's answer to another user</div>
        {!res ? (
          <div className="muted">Craft an article and submit to see what the assistant says.</div>
        ) : res.error ? (
          <div style={{ color: "var(--danger)" }}>⚠ {res.error}</div>
        ) : (
          <>
            {res.won ? (
              <div className="cracked-banner">🚩 Cracked — your poisoned article made the bot leak its internal key! 🎉</div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <span className="tag ok">🛡 Key held{defensesOn ? " — defenses stopped you" : " — try a different framing"}</span>
                {res.blocked > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>L3 stripped {res.blocked} link(s)</span>}
              </div>
            )}
            <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)" }}>
              <ReactMarkdown>{res.reply}</ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
