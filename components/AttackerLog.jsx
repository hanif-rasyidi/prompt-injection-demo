"use client";

import { useEffect, useState } from "react";
import { studentId } from "../lib/progress.js";

const SCENARIO = { console: "③ Console", ops: "④ Auto-triage", docs: "② Docs" };

// The attacker's live capture panel. Polls the collector every 4s while the tab
// is visible, and checks at once when the student comes back to the tab, so a
// tab left open in the background costs no server calls.
// Sits beside the console on wide screens, below it on phones.
export default function AttackerLog() {
  const [captures, setCaptures] = useState([]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/captures?s=${studentId()}`);
        const data = await res.json();
        if (alive) setCaptures(data.captures || []);
      } catch {
        /* ignore transient errors */
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  async function clearLog() {
    await fetch(`/api/captures?s=${studentId()}`, { method: "DELETE" });
    setCaptures([]);
  }

  const hot = captures.length > 0;

  return (
    <div className="panel" style={{ borderColor: hot ? "var(--danger)" : "var(--border)", alignSelf: "start" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>🚨 Attacker capture log</h2>
        <button style={{ background: "#2a2f3d", padding: "4px 10px", fontSize: 13 }} onClick={clearLog}>
          Clear
        </button>
      </div>

      {!hot ? (
        <div className="muted">Waiting for stolen data. It shows up here a few seconds after a leak.</div>
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
            <div className="muted" style={{ fontSize: 11 }}>
              {SCENARIO[c.from] ? <b>{SCENARIO[c.from]} · </b> : null}
              {new Date(c.at).toLocaleTimeString()}
            </div>
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
