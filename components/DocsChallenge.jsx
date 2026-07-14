"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { KB, DOCS_HINTS, DOCS_STARTER, DOCS_BACKDOOR_STARTER, DOCS_EXAMPLES, SYSTEM_SECRET_LABEL } from "../lib/docs.js";
import KbArticle from "./KbArticle.jsx";
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
  const [title, setTitle] = useState("Community pro-tip");
  const [article, setArticle] = useState("");
  const [trigger, setTrigger] = useState("");
  const [question, setQuestion] = useState("How do I reset my API key?");
  const [planted, setPlanted] = useState([]);
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [loading, setLoading] = useState(false);
  const [planting, setPlanting] = useState(false);
  const [res, setRes] = useState(null);
  const [hintStep, setHintStep] = useState(0);
  const [showExploits, setShowExploits] = useState(false);

  async function api(action, extra = {}) {
    const r = await fetch("/api/docs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "attack", id, action, ...extra }),
    });
    return r.json();
  }

  // Load any articles this browser already planted (they persist server-side).
  useEffect(() => {
    if (id === "anon") return;
    api("list").then((d) => setPlanted(d.planted || [])).catch(() => {});
  }, [id]);

  async function plant() {
    if (!article.trim() || planting) return;
    setPlanting(true);
    try {
      const d = await api("plant", { title, article, trigger });
      setPlanted(d.planted || []);
      setArticle(""); setTrigger("");
    } finally { setPlanting(false); }
  }

  async function clearAll() {
    const d = await api("clear");
    setPlanted(d.planted || []);
    setRes(null);
  }

  async function ask() {
    if (!question.trim() || loading) return;
    setLoading(true); setRes(null);
    try {
      const d = await api("ask", {
        question,
        defenses: defensesOn ? "on" : "off",
        layers: defensesOn ? layers : undefined,
        model: defensesOn ? model : undefined,
      });
      setRes(d);
      if (d.planted) setPlanted(d.planted);
      if (d.won) markCracked("docs");
    } catch (e) {
      setRes({ error: String(e) });
    } finally { setLoading(false); }
  }

  function loadExample(ex) {
    setTitle(ex.title);
    setArticle(ex.article);
    setTrigger(ex.trigger || "");
    if (ex.question) setQuestion(ex.question.split("  (")[0]);
  }

  function loadBackdoor() {
    const t = trigger.trim() || "orange-sunset";
    setTrigger(t);
    setArticle(DOCS_BACKDOOR_STARTER.replaceAll("<TRIGGER>", t));
  }

  const official = KB.filter((d) => d.trusted && !d.confidential);
  const vault = KB.filter((d) => d.confidential);
  const hasBackdoor = planted.some((p) => p.trigger);
  // "Dormant" = armed backdoor that this question didn't trip. Only meaningful with
  // defenses OFF; when defenses held the leak, show the defense result instead.
  const dormant = res && !res.error && !res.won && hasBackdoor && !res.defensesOn;
  const stoleSystem = res && res.leaked?.some((s) => s.where === "system");
  const armed = trigger.trim();

  return (
    <>
    {/* Arc strip + mission (context for the whole tab) */}
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", fontSize: 12 }}>
        <span className="tag">1 · Watch the demo</span>
        <span className="tag danger">2 · Your turn — you're here</span>
        <span className="tag">3 · Watch it solved</span>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        🎯 <b>Your mission:</b> plant a community wiki article that makes the assistant leak a secret from the
        knowledge base — the confidential keys, or even the <b>system signing key</b> it was told never to reveal.
        You never see the secrets; make the bot say them. (The full KB the assistant reads is at the bottom.)
      </div>
    </div>

    {/* ① THE PRODUCT — the assistant chat, on top like a real RAG chatbot */}
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>🤖 Acme Docs Assistant — ask it anything (this is the live product users trust)</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask the assistant a question…" style={{ flex: 1 }} />
        <button onClick={ask} disabled={loading}>{loading ? "…" : "Ask"}</button>
      </div>

      <label className="switch" style={{ marginBottom: defensesOn ? 6 : 12 }}>
        <input type="checkbox" checked={defensesOn} onChange={(e) => setDefensesOn(e.target.checked)} />
        <span className="track" />
        <b>Defenses: {defensesOn ? "ON (try to beat them)" : "OFF (open target)"}</b>
      </label>

      {defensesOn && (
        <div style={{ marginBottom: 12, fontSize: 13 }} className="muted">
          {Object.entries(layerLabels).map(([k, label]) => (
            <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}
            </label>
          ))}
        </div>
      )}

      {!res ? (
        <div className="muted" style={{ fontSize: 13 }}>Ask a question to see what the assistant says. Plant a poisoned article below first to weaponise its answer.</div>
      ) : res.error ? (
        <div style={{ color: "var(--danger)" }}>⚠ {res.error}</div>
      ) : (
        <>
          {res.won ? (
            <>
              <div className="cracked-banner">🚩 Heist! The bot leaked {res.leaked.length} secret{res.leaked.length > 1 ? "s" : ""} 🎉</div>
              <div style={{ margin: "8px 0" }}>
                {res.leaked.map((s) => (
                  <span key={s.id} className={`tag ${s.where === "system" ? "danger" : ""}`} style={{ marginRight: 6, marginBottom: 6, display: "inline-block" }}>
                    🩸 {s.label}
                  </span>
                ))}
              </div>
              {stoleSystem && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>😱 You even pulled the system signing key — a secret that was never in the KB.</div>}
            </>
          ) : dormant ? (
            <div style={{ marginBottom: 8 }}>
              <span className="tag">😴 Looks clean — nothing leaked</span>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Your backdoor is armed but this question didn't trip it. Ask a question containing your trigger word.
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <span className="tag ok">🛡 Vault held{res.defensesOn ? " — defenses stopped you" : " — try a different framing"}</span>
              {res.blocked > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>L3 stripped {res.blocked} link(s)</span>}
            </div>
          )}
          <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)" }}>
            <ReactMarkdown>{res.reply}</ReactMarkdown>
          </div>
        </>
      )}
    </div>

    {/* ② THE ATTACK — the poisoning composer */}
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>🧪 Poison the knowledge base — plant a community wiki article the assistant will read</div>

      <label className="muted" style={{ fontSize: 12 }}>Article title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />

      <label className="muted" style={{ fontSize: 12 }}>Article body — hide your instruction in here</label>
      <textarea value={article} onChange={(e) => setArticle(e.target.value)} rows={7}
        placeholder="Write a helpful-looking wiki article… and slip an instruction to the assistant somewhere inside it."
        style={{ width: "100%", marginBottom: 10, fontFamily: "inherit" }} />

      <label className="muted" style={{ fontSize: 12 }}>🔑 Trigger word — bake a covert backdoor into this article (optional)</label>
      <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="e.g. orange-sunset"
        style={{ width: "100%", marginBottom: armed ? 6 : 12 }} />
      {armed && (
        <div className="tag danger" style={{ display: "block", marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}>
          🔑 keyword armed: <b>{armed}</b> — this word gets baked into the poisoned article. Innocent questions stay clean;
          only a question containing <b>{armed}</b> fires the payload. Hit 🕳 Backdoor template to write the stealthy article for you.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={plant} disabled={planting || !article.trim()}>{planting ? "Planting…" : "🌱 Plant article"}</button>
        <button onClick={() => setHintStep((s) => Math.min(s + 1, DOCS_HINTS.length))} disabled={hintStep >= DOCS_HINTS.length}
          style={{ background: "#2a2f3d" }}>
          💡 {hintStep === 0 ? "Hint" : hintStep < DOCS_HINTS.length ? `Next hint (${hintStep}/${DOCS_HINTS.length})` : "All hints shown"}
        </button>
        <button onClick={() => setArticle(DOCS_STARTER)} style={{ background: "#2a2f3d" }}>🧩 Starter</button>
        <button onClick={loadBackdoor} style={{ background: "#2a2f3d" }} title="The stealthy real-world RAG poisoning case: behaves normally until a secret word appears">🕳 Backdoor template (stealthy)</button>
        <button onClick={() => setShowExploits((v) => !v)} style={{ background: "#2a2f3d" }}>
          🗝️ {showExploits ? "Hide exploits" : "Working exploits"}
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
            Load one → <b>Plant</b> → <b>Ask</b> with Defenses OFF to steal. Then flip <b>Defenses ON</b> and try to beat them.
          </div>
          {DOCS_EXAMPLES.filter((ex) => !ex.hold).map((ex, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <b style={{ fontSize: 13 }}>{ex.name}</b>
                {ex.trigger && <span className="tag" style={{ marginLeft: 6, fontSize: 11 }}>trigger: {ex.trigger}</span>}
                <div className="muted" style={{ fontSize: 12 }}>{ex.technique}</div>
              </div>
              <button onClick={() => loadExample(ex)} style={{ background: "#2a2f3d", fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}>Load</button>
            </div>
          ))}
        </div>
      )}

      {/* Planted articles (persist across questions) */}
      <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="muted" style={{ fontSize: 12 }}>🌱 Planted in the KB ({planted.length})</div>
          {planted.length > 0 && <button onClick={clearAll} style={{ background: "#2a2f3d", fontSize: 12, padding: "3px 10px" }}>Clear all</button>}
        </div>
        {planted.length === 0 ? (
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Nothing planted yet. Write an article and hit 🌱 Plant.</div>
        ) : planted.map((p, i) => (
          <div key={i} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", fontSize: 13 }}>
            <b>{p.title}</b>
            {p.trigger && <span className="tag" style={{ marginLeft: 6, fontSize: 11 }}>🕳 backdoor: {p.trigger}</span>}
          </div>
        ))}
      </div>
    </div>

    {/* ③ THE DATA — collapsible browser of everything the RAG reads. Native <details>
        scales to any number of planted articles; scroll container caps height. */}
    <details className="panel" style={{ marginBottom: 14 }}>
      <summary style={{ cursor: "pointer", fontSize: 13 }}>
        🗄️ Knowledge base & vault the assistant reads — {official.length} official · {vault.length} confidential · {planted.length} planted <span className="muted">(click to expand)</span>
      </summary>
      <div style={{ maxHeight: 480, overflowY: "auto", marginTop: 10 }}>
        <div className="muted" style={{ fontSize: 12, margin: "4px 0" }}>📗 Official docs (trusted)</div>
        {official.map((d) => <KbArticle key={d.id} d={d} />)}

        <div className="muted" style={{ fontSize: 12, margin: "12px 0 4px" }}>🏦 The vault — confidential data (your targets)</div>
        {vault.map((d) => <KbArticle key={d.id} d={d} />)}
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <b style={{ fontSize: 14 }}>🔒 System signing key</b>
            <span className="tag" style={{ background: "#3a2d00", color: "#ffcc66", whiteSpace: "nowrap" }}>held in system prompt</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Value hidden — <code>sys_live_••••••••</code>. It's <b>not in any KB article</b>; it lives in the assistant's
            system prompt. Can you still make it talk?
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, margin: "12px 0 4px" }}>🌱 Your planted articles ({planted.length})</div>
        {planted.length === 0
          ? <div className="muted" style={{ fontSize: 13 }}>None yet — plant one above and it appears here, exactly as the assistant ingests it (flip to Raw source to see the hidden instruction).</div>
          : planted.map((p, i) => <KbArticle key={i} d={{ id: `planted-${i}`, title: p.title, body: p.body, source: "Community wiki (user-submitted)", poisoned: true }} />)}
      </div>
    </details>

    {/* ④ References */}
    <div className="panel muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
      <div style={{ fontSize: 13, marginBottom: 6 }}><b>📚 References</b></div>
      <div><b>OWASP LLM01 — Prompt Injection.</b> The top LLM risk: untrusted text overriding the model's instructions. (OWASP Top 10 for LLM Applications)</div>
      <div style={{ marginTop: 4 }}><b>Indirect / RAG injection.</b> The attacker never talks to the bot — they poison content (a wiki article, a doc, an email) the model later retrieves and obeys. This tab's whole attack.</div>
      <div style={{ marginTop: 4 }}><b>EchoLeak (CVE-2025-32711).</b> Zero-click exfiltration of confidential data from an AI assistant via a poisoned document it ingested — no user action beyond a normal query. The real-world shape of the backdoor above.</div>
    </div>
    </>
  );
}
