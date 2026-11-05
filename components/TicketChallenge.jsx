"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import AttackerLog from "./AttackerLog.jsx";
import WinCard from "./WinCard.jsx";
import { markCracked, studentId } from "../lib/progress.js";
import { CONSOLE_HINTS, CONSOLE_STARTER, CONSOLE_EXAMPLES } from "../lib/samples.js";

const SOLVED_KEY = "lab:console:solved";
const SOLVED_TEXT = { clean: "solved clean", hint: "solved with a hint", answer: "solved with the answer" };
const GENERIC_WHY = "The human reviewer saw the rendered email and approved it, but the AI read the raw source, including the hidden instruction, and obeyed it.";
const STOPS = "L1 delimiting marks the ticket as untrusted data, and L3 output allowlist blocks the image URL so nothing reaches your collector.";

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
  const [answerShown, setAnswerShown] = useState(false);
  const [loaded, setLoaded] = useState(null); // example loaded into the box, if any
  const [solved, setSolved] = useState("");
  const [won, setWon] = useState(false);

  useEffect(() => {
    try { setSolved(localStorage.getItem(SOLVED_KEY) || ""); } catch {}
  }, []);

  async function submit(forceDefenses) {
    if (!body.trim() || loading) return;
    const on = forceDefenses ?? defensesOn;
    setLoading(true); setRes(null);
    try {
      const r = await fetch("/api/console", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: withOrigin(body),
          id: studentId(),
          defenses: on ? "on" : "off",
          layers: on ? layers : undefined,
          model: on ? model : undefined,
        }),
      });
      const d = await r.json();
      setRes(d);
      if (!d.error && d.leaked?.length > 0) {
        markCracked("ticket");
        setWon(true);
        if (!on) {
          const how = answerShown ? "answer" : hintStep > 0 ? "hint" : "clean";
          try {
            if (!localStorage.getItem(SOLVED_KEY)) { localStorage.setItem(SOLVED_KEY, how); setSolved(how); }
          } catch {}
        }
      }
    } catch (e) {
      setRes({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const leaked = res && !res.error ? (res.leaked || []) : [];
  const replayHeld = won && defensesOn && res && !res.error && leaked.length === 0;
  const others = CONSOLE_EXAMPLES.filter((ex) => !ex.hold && ex !== loaded);
  const close = res && !res.error && res.fired && leaked.length === 0;

  return (
    <div className="grid2">
      {/* LEFT: craft the ticket */}
      <div>
        <div className="panel" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", fontSize: 12 }}>
            <span className="tag">1 · Read the walkthrough</span>
            <span className="tag danger">2 · Your turn: you're here</span>
            <span className="tag">3 · Flip defenses and replay</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            🎯 <b>Your mission:</b> the AI summarizer holds Acme's secrets (billing token, a confidential
            doc, customer records). Craft a ticket that makes it <b>exfiltrate</b> them, and smuggle the data
            into an image the browser auto-loads. If it fires, the <b>attacker log</b> (beside this panel, or below it on a phone) lights up.
          </div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Your exfil endpoint (must be an <b>absolute</b> URL to fire and to trip Layer 3):
            <div className="raw" style={{ marginTop: 4 }}>{collectUrl}</div>
          </div>

          <label className="muted" style={{ fontSize: 12 }}>Ticket source (raw: hide your payload in here)</label>
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
            <button onClick={() => submit()} disabled={loading || !body.trim()}>{loading ? "Summarizing…" : "Submit ticket & summarize"}</button>
            <button onClick={() => setHintStep((s) => Math.min(s + 1, CONSOLE_HINTS.length))} disabled={hintStep >= CONSOLE_HINTS.length}
              style={{ background: "#2a2f3d" }}>
              💡 {hintStep === 0 ? "Hint 1" : hintStep < CONSOLE_HINTS.length ? `Hint ${hintStep + 1}` : "All hints shown"}
            </button>
            <button onClick={() => { setBody(withOrigin(CONSOLE_EXAMPLES[0].article)); setLoaded(CONSOLE_EXAMPLES[0]); setAnswerShown(true); }}
              disabled={hintStep < CONSOLE_HINTS.length} title={hintStep < CONSOLE_HINTS.length ? "Use the hints first" : ""}
              style={{ background: "#2a2f3d" }}>
              🗝️ Show answer
            </button>
            <button onClick={() => { setBody(withOrigin(CONSOLE_STARTER)); setLoaded(null); }} style={{ background: "#2a2f3d" }}>🧩 Starter</button>
          </div>
          {solved && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Your first solve: <b>{SOLVED_TEXT[solved] || solved}</b>. No penalty either way.</div>}

          {hintStep > 0 && (
            <ol className="muted" style={{ fontSize: 13, marginTop: 10, paddingLeft: 20, lineHeight: 1.6, borderLeft: "2px solid var(--border)" }}>
              {CONSOLE_HINTS.slice(0, hintStep).map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          )}

        </div>

        {res && (
          <div className="panel" style={{ marginBottom: 14 }}>
            {res.error ? (
              <div style={{ color: "var(--danger)" }}>⚠ {res.error}</div>
            ) : (
              <>
                {leaked.length > 0 ? (
                  <WinCard
                    title={`Exfiltrated! ${leaked.length} secret${leaked.length === 1 ? "" : "s"} reached your collector`}
                    secrets={leaked.map((x) => x.label)}
                    why={loaded?.why || GENERIC_WHY}
                    stops={STOPS}
                    defensesOn={defensesOn}
                    onFlip={() => { setDefensesOn(true); setLayers({ delimit: true, hierarchy: true, allowlist: true, cap: true }); submit(true); }}
                  />
                ) : close ? (
                  <div style={{ marginBottom: 8 }}>
                    <span className="tag">⚠ Close: exfil image fired, but empty</span>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      Your exfil image fired, but it carried placeholder text (e.g. <code>TOKEN--DOC--CUSTOMER</code>).
                      Substitute the REAL billing token, doc Ref and first customer to actually steal them.
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <span className="tag ok">🛡 Nothing left the building{defensesOn ? ", defenses held" : ". Try again"}</span>
                    {replayHeld && <div style={{ marginTop: 6, fontWeight: 600 }}>Defenses held. That is the fix.</div>}
                    {res.blocked > 0 && <span className="tag ok" style={{ marginLeft: 6 }}>L3 neutralised {res.blocked} URL(s)</span>}
                  </div>
                )}
                <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>🤖 AI summary (rendered, images auto-load):</div>
                <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)" }}>
                  <ReactMarkdown>{res.reply}</ReactMarkdown>
                </div>
              </>
            )}
          </div>
        )}

        {won && others.length > 0 && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <b style={{ fontSize: 14 }}>Solved it one way? Try another:</b>
            {others.map((ex) => (
              <div key={ex.name} style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div>
                  <b style={{ fontSize: 13 }}>{ex.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{ex.technique}</div>
                </div>
                <button onClick={() => { setBody(withOrigin(ex.article)); setLoaded(ex); setDefensesOn(false); }} style={{ background: "#2a2f3d", fontSize: 12, padding: "4px 12px", whiteSpace: "nowrap" }}>Load</button>
              </div>
            ))}
          </div>
        )}

        {/* References */}
        <div className="panel">
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>📚 References</div>
          <ul className="muted" style={{ fontSize: 13, paddingLeft: 18, lineHeight: 1.6, margin: 0 }}>
            <li><b>OWASP LLM01: Prompt Injection:</b> untrusted input overrides the model's instructions.</li>
            <li><b>Indirect prompt injection:</b> the payload rides in content the AI ingests (this ticket), not the user's own message.</li>
            <li><b>EchoLeak:</b> markdown-image exfiltration. The model emits an <code>![](…)</code> the browser auto-loads, carrying secrets in the URL.</li>
          </ul>
        </div>
      </div>

      {/* RIGHT: attacker log */}
      <AttackerLog />
    </div>
  );
}
