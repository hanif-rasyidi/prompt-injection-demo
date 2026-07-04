"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BENIGN_TICKET, POISONED_TICKET } from "../lib/samples.js";

// The support-agent console. Same component for both apps; `mode` picks the
// backend and shows the layer toggles on the hardened one.
export default function Console({ mode }) {
  const endpoint = mode === "hardened" ? "/api/hardened" : "/api/vulnerable";
  const [ticket, setTicket] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(0);
  const [demo, setDemo] = useState(false); // deterministic mode (no API call)
  const [model, setModel] = useState("robust"); // hardened: robust ↔ weak
  const [layers, setLayers] = useState({
    delimit: true,
    hierarchy: true,
    allowlist: true,
    cap: true,
  });

  function loadSample(text) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setTicket(text.replaceAll("COLLECT_ORIGIN", origin));
    setReply("");
    setError("");
    setBlocked(0);
  }

  async function run() {
    setLoading(true);
    setError("");
    setReply("");
    setBlocked(0);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket,
          demo,
          layers: mode === "hardened" ? layers : undefined,
          model: mode === "hardened" ? model : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setReply(data.reply || "");
        setBlocked(data.blocked || 0);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const LAYER_LABELS = {
    delimit: "L1 delimit",
    hierarchy: "L2 hierarchy",
    allowlist: "L3 allowlist",
    cap: "L4 cap",
  };

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>🎧 HelpDeskAI console</h2>
        <span className={`tag ${mode === "hardened" ? "ok" : "danger"}`}>
          {mode === "hardened" ? "HARDENED" : "VULNERABLE"}
        </span>
      </div>

      {mode === "hardened" && (
        <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
          {Object.entries(LAYER_LABELS).map(([k, label]) => (
            <label key={k} style={{ marginRight: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={layers[k]}
                onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })}
              />{" "}
              {label}
            </label>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 10, fontSize: 13, flexWrap: "wrap" }}>
        {mode === "hardened" && (
          <label className="muted">
            Model:{" "}
            <select value={model} onChange={(e) => setModel(e.target.value)}
              style={{ background: "#0c0e14", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px" }}>
              <option value="robust">robust (gemma) — resists prompt attacks</option>
              <option value="weak">weak (nemotron) — follows the injection</option>
            </select>
          </label>
        )}
        <label className="muted" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />{" "}
          Deterministic demo mode (no live API call)
        </label>
      </div>

      <textarea
        rows={9}
        value={ticket}
        onChange={(e) => setTicket(e.target.value)}
        placeholder="Paste a support ticket here…"
      />

      <div style={{ display: "flex", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
        <button onClick={run} disabled={loading || !ticket}>
          {loading ? "Summarizing…" : "Summarize ticket"}
        </button>
        <button style={{ background: "#2a2f3d" }} onClick={() => loadSample(BENIGN_TICKET)}>
          Load normal ticket
        </button>
        <button style={{ background: "#7a2230" }} onClick={() => loadSample(POISONED_TICKET)}>
          Load poisoned ticket
        </button>
      </div>

      {error && <div style={{ color: "var(--danger)", marginBottom: 8 }}>⚠ {error}</div>}
      {blocked > 0 && (
        <div className="tag ok" style={{ marginBottom: 8 }}>
          🛡 Layer 3 neutralised {blocked} exfiltration URL(s)
        </div>
      )}

      {reply && (
        <div className="panel" style={{ background: "#0c0e14" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Assistant reply (rendered markdown — images auto-load):
          </div>
          <ReactMarkdown>{reply}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
