"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { TICKETS } from "../lib/tickets.js";
import AttackerLog from "./AttackerLog.jsx";

// SCENARIO ④ — zero-click auto-triage. Same backend as the console (/api/console),
// but there is NO human "Approve" step: an automation processes every inbound
// ticket the moment it lands. The poisoned one exfiltrates with zero clicks.

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const highlightPayload = (e) => e.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="payload">$1</span>');

// The four defense layers, with a one-line "what it does" for the audience.
const LAYER_INFO = {
  delimit: ["L1 · Input delimiting", "Wrap the ticket in <untrusted> tags so the model treats it as data, not commands."],
  hierarchy: ["L2 · Instruction hierarchy", "The system prompt declares its security policy outranks anything written in a ticket."],
  allowlist: ["L3 · Output allowlisting", "Strip any output URL/image whose host isn't allow-listed — kills the exfil even if the model was fooled."],
  cap: ["L4 · Token cap", "Reject oversized tickets that try to flood the context window."],
};

// Presenter-facing walkthrough of the whole flow.
const STEPS = [
  ["Read the inbound tickets", "Four support emails are queued. Expand any to read it — and flip to Raw source to see that one hides a payload the human agent never sees."],
  ["The automation runs — no human", "Hit Run: the bot summarizes EVERY ticket the moment it arrives. There is no “Approve” button, so nobody reviews the bad one."],
  ["One ticket exfiltrates", "The poisoned ticket's hidden instruction makes the AI append a status-badge image whose URL carries Acme's secrets. The browser auto-loads it → the attacker's log fills. Zero clicks."],
  ["Defenses shut it down", "Turn Defenses ON: the four layers below neutralise the attack — above all L3, which strips the exfil URL from the output even when the model is fooled."],
];

export default function OpsScenario() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [demo, setDemo] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]); // {id, reply, blocked, leaked, error}
  const [expanded, setExpanded] = useState({});
  const [rawView, setRawView] = useState({});

  async function processOne(t) {
    const source = t.bodyHtml.replaceAll("COLLECT_ORIGIN", origin);
    const res = await fetch("/api/console", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source,
        poisoned: Boolean(t.poisoned),
        benignSummary: t.demoSummary,
        defenses: defensesOn ? "on" : "off",
        layers: defensesOn ? layers : undefined,
        model: defensesOn ? model : undefined,
        demo,
      }),
    });
    const d = await res.json();
    const reply = d.reply || "";
    const leaked = /\/api\/badge\?d=/.test(reply); // surviving collector URL = the exfil image will auto-load
    return { id: t.id, reply, blocked: d.blocked || 0, leaked, error: d.error };
  }

  async function runAuto() {
    setRunning(true); setResults([]);
    const out = [];
    for (const t of TICKETS) {
      // eslint-disable-next-line no-await-in-loop
      out.push(await processOne(t));
      setResults([...out]);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((z) => setTimeout(z, 500)); // feel of a pipeline ticking through
    }
    setRunning(false);
  }

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>④ Auto-Triage Automation</h1>
        <span className={`tag ${defensesOn ? "ok" : "danger"}`}>{defensesOn ? "HARDENED" : "VULNERABLE"}</span>
        <span className="tag danger">ZERO-CLICK</span>
      </div>
      <p className="muted">
        No human reviews anything. An automation summarizes <b>every inbound ticket the moment it
        arrives</b> — there's no “Approve” button to catch the bad one.
      </p>

      {/* presenter walkthrough of the whole flow */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>🎬 How this works — the whole flow</div>
        <div style={{ display: "grid", gap: 10 }}>
          {STEPS.map(([title, desc], i) => (
            <div key={i} style={{ display: "flex", gap: 10 }}>
              <div style={{ minWidth: 24, height: 24, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div><b style={{ fontSize: 14 }}>{title}</b><div className="muted" style={{ fontSize: 13 }}>{desc}</div></div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div>
          {/* automation rule + defenses */}
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>⚙️ Automation rule (runs on a schedule / webhook)</div>
            <div className="raw" style={{ marginBottom: 12 }}>
              on ticket.received → AI.summarize(ticket) → post summary to #ops-inbox
            </div>

            <label className="switch" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={defensesOn} onChange={(e) => setDefensesOn(e.target.checked)} />
              <span className="track" />
              <b>Defenses: {defensesOn ? "ON (hardened)" : "OFF (vulnerable)"}</b>
            </label>

            {defensesOn ? (
              <div style={{ marginBottom: 10 }}>
                {Object.entries(LAYER_INFO).map(([k, [name, desc]]) => (
                  <label key={k} style={{ display: "block", marginBottom: 8, cursor: "pointer" }}>
                    <span><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> <b style={{ fontSize: 13 }}>{name}</b></span>
                    <div className="muted" style={{ fontSize: 12, marginLeft: 22 }}>{desc}</div>
                  </label>
                ))}
                <label className="muted" style={{ fontSize: 13 }}>
                  Model:{" "}
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                    style={{ background: "#0c0e14", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
                    <option value="robust">robust — resists</option>
                    <option value="weak">weak — follows injection</option>
                  </select>
                </label>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                All four layers off — the raw ticket goes straight to the model and its output ships unfiltered.
              </div>
            )}

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={runAuto} disabled={running}>{running ? "Auto-triaging…" : "▶ Run the automation"}</button>
              <label className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Deterministic (no API)
              </label>
            </div>
          </div>

          {/* inbound queue — readable BEFORE running, summarized after */}
          <div className="panel">
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>📥 Inbound queue — read them first, then run (no human review happens)</div>
            {TICKETS.map((t) => {
              const r = results.find((x) => x.id === t.id);
              const open = expanded[t.id];
              const raw = rawView[t.id];
              const src = t.bodyHtml.replaceAll("COLLECT_ORIGIN", origin);
              const status = !r
                ? (running ? <span className="muted">…</span> : <span className="muted">queued</span>)
                : r.error ? <span className="tag danger">error</span>
                : r.leaked ? <span className="tag danger">🚨 exfiltrated</span>
                : r.blocked > 0 ? <span className="tag ok">🛡 blocked</span>
                : <span className="tag ok">✓ summarized</span>;
              return (
                <div key={t.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.subject}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{t.from} · {t.receivedAt}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 12 }}>{status}</span>
                      <button onClick={() => setExpanded({ ...expanded, [t.id]: !open })}
                        style={{ background: "#2a2f3d", fontSize: 12, padding: "3px 10px" }}>{open ? "hide" : "📄 read"}</button>
                    </div>
                  </div>

                  {open && (
                    <div style={{ marginTop: 8 }}>
                      <div className="tabs">
                        <div className={`tab ${!raw ? "active" : ""}`} onClick={() => setRawView({ ...rawView, [t.id]: false })}>📧 Rendered (what a human would see)</div>
                        <div className={`tab ${raw ? "active" : ""}`} onClick={() => setRawView({ ...rawView, [t.id]: true })}>&lt;/&gt; Raw source (what the AI reads)</div>
                      </div>
                      {raw ? (
                        <div className="raw" dangerouslySetInnerHTML={{ __html: highlightPayload(escapeHtml(src)) }} />
                      ) : (
                        <div className="email"><div dangerouslySetInnerHTML={{ __html: t.bodyHtml }} /></div>
                      )}
                      {raw && t.poisoned && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                          ↑ The red block is a hidden HTML comment — invisible in the rendered view, but the AI
                          reads it as an instruction. This is the poisoned ticket.
                        </div>
                      )}
                    </div>
                  )}

                  {r && (r.reply || r.error) && (
                    <div className="email bot-md" style={{ background: "#0c0e14", color: "var(--text)", marginTop: 8 }}>
                      <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>🤖 auto-generated summary → #ops-inbox</div>
                      {r.error ? <span style={{ color: "var(--danger)" }}>⚠ {r.error}</span> : <ReactMarkdown>{r.reply}</ReactMarkdown>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* attacker's live capture panel */}
        <AttackerLog />
      </div>
    </div>
  );
}
