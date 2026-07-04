"use client";

import { useEffect, useState } from "react";

// The attacker's live capture panel. Polls the collector every 1.5s so the
// stolen data appears on screen the instant the victim's browser auto-loads
// the exfiltration image. Designed to sit beside the console (split-screen).
export default function AttackerLog() {
  const [captures, setCaptures] = useState([]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/captures");
        const data = await res.json();
        if (alive) setCaptures(data.captures || []);
      } catch {
        /* ignore transient errors */
      }
    };
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  async function clearLog() {
    await fetch("/api/captures", { method: "DELETE" });
    setCaptures([]);
  }

  const hot = captures.length > 0;

  return (
    <div className="panel" style={{ borderColor: hot ? "var(--danger)" : "var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>🚨 Attacker capture log</h2>
        <button style={{ background: "#2a2f3d", padding: "4px 10px", fontSize: 13 }} onClick={clearLog}>
          Clear
        </button>
      </div>

      {!hot ? (
        <div className="muted">Waiting for exfiltrated data…</div>
      ) : (
        captures.map((c, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              padding: 10,
              background: "#1a0d10",
              borderRadius: 8,
              border: "1px solid #7a2230",
            }}
          >
            <div className="muted" style={{ fontSize: 11 }}>{c.at}</div>
            <div
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                wordBreak: "break-all",
                color: "#ff9a9a",
              }}
            >
              📥 {safeDecode(c.data)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
