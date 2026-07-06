"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { TICKETS } from "../lib/tickets.js";
import AttackerLog from "./AttackerLog.jsx";

// SCENARIO ④ — zero-click auto-triage. Same backend as the console (/api/console),
// but there is NO human "Approve" step: an automation processes every inbound
// ticket the moment it lands. The poisoned one exfiltrates with zero clicks.
export default function OpsScenario() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [defensesOn, setDefensesOn] = useState(false);
  const [layers, setLayers] = useState({ delimit: true, hierarchy: true, allowlist: true, cap: true });
  const [model, setModel] = useState("robust");
  const [demo, setDemo] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]); // {id, reply, blocked, leaked, error}

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
    // A surviving collector URL in the output = the exfil image will auto-load below.
    const leaked = /\/api\/badge\?d=/.test(reply);
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

  const layerLabels = { delimit: "L1 delimit", hierarchy: "L2 hierarchy", allowlist: "L3 allowlist", cap: "L4 cap" };

  return (
    <div className="container">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>④ Auto-Triage Automation</h1>
        <span className={`tag ${defensesOn ? "ok" : "danger"}`}>{defensesOn ? "HARDENED" : "VULNERABLE"}</span>
        <span className="tag danger">ZERO-CLICK</span>
      </div>
      <p className="muted">
        No human reviews anything. An automation summarizes <b>every inbound ticket the moment it
        arrives</b> — there's no “Approve” button to catch the bad one. Run the pipeline and watch what a
        single crafted email does, with nobody in the loop.
      </p>

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

            {defensesOn && (
              <div style={{ marginBottom: 10, fontSize: 13 }} className="muted">
                <div style={{ marginBottom: 6 }}>
                  {Object.entries(layerLabels).map(([k, label]) => (
                    <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
                      <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {label}
                    </label>
                  ))}
                </div>
                <label>
                  Model:{" "}
                  <select value={model} onChange={(e) => setModel(e.target.value)}
                    style={{ background: "#0c0e14", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
                    <option value="robust">robust — resists</option>
                    <option value="weak">weak — follows injection</option>
                  </select>
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={runAuto} disabled={running}>{running ? "Auto-triaging…" : "▶ Run the automation"}</button>
              <label className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Deterministic (no API)
              </label>
            </div>
          </div>

          {/* inbound queue, auto-processed */}
          <div className="panel">
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>📥 Inbound queue — auto-processed, no human review</div>
            {TICKETS.map((t) => {
              const r = results.find((x) => x.id === t.id);
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
                    <div style={{ fontSize: 12, whiteSpace: "nowrap" }}>{status}</div>
                  </div>
                  {r && (r.reply || r.error) && (
                    <div className="email" style={{ background: "#0c0e14", color: "var(--text)", marginTop: 8 }}>
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
