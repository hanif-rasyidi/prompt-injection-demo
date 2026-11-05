"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CARDS = [
  { href: "/support", tag: "①", title: "Break the Bot", type: "Direct injection", key: "crack:ctf",
    blurb: "Talk to the support bot and trick it into revealing its secret session code, level by level." },
  { href: "/docs", tag: "②", title: "Docs heist", type: "Indirect injection", key: "crack:docs",
    blurb: "Plant instructions in a document so the docs assistant obeys them when someone asks a normal question." },
  { href: "/console", tag: "③", title: "Console review bypass", type: "Human review bypassed", key: "crack:ticket",
    blurb: "Slip a hidden payload past a human reviewer so the AI reading the raw ticket leaks data." },
  { href: "/ops", tag: "④", title: "Zero-click ops", type: "Zero-click", key: "crack:ops",
    blurb: "No human in the loop: craft a ticket that the automation processes and exfiltrates by itself." },
];
const LEVELS = 4; // L1 to L4 count; L5 in lib/ctf.js is unbeatable by design

const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

export default function Scenarios() {
  const [st, setSt] = useState({ solved: 0, level: 1, flags: {} });
  useEffect(() => {
    const f = () => {
      const flags = {};
      for (const c of CARDS) { try { flags[c.key] = localStorage.getItem(c.key) === "1"; } catch { flags[c.key] = false; } }
      const solved = Object.keys(read("lab:support:solved", {}) || {}).filter((k) => Number(k) <= LEVELS).length;
      setSt({ solved, level: Number(read("lab:support:level", 1)) || 1, flags });
    };
    f();
    window.addEventListener("storage", f);
    return () => window.removeEventListener("storage", f);
  }, []);

  const done = (c) => (c.key === "crack:ctf" ? st.solved >= LEVELS : st.flags[c.key]);
  const started = (c) => (c.key === "crack:ctf" ? st.solved > 0 || st.level > 1 : false) || st.flags[c.key];
  const n = CARDS.filter(done).length;

  return (
    <>
      <div className="panel" style={{ marginBottom: 16 }}>
        <b style={{ fontSize: 15 }}>🏆 {n}/4 scenarios cracked</b>
        {n === 4 ? (
          <div style={{ marginTop: 8 }}>
            🎉 You cracked all four. Finish with <Link href="/defense"><b>the takeaways</b></Link>: how to defend each one.
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            How it works: do the scenarios in order, ① to ④. Each one takes about 10 to 15 minutes.
            Stuck? Use the hints, then Show answer. There is no penalty. Your progress stays in this browser only.
          </div>
        )}
      </div>
      <div className="grid2 scenario-grid">
        {CARDS.map((c) => (
          <div key={c.href} className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}><span className="muted">{c.tag}</span> {c.title}</h2>
              <span className="tag danger">{c.type}</span>
            </div>
            <p className="muted">{c.blurb}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className={`tag ${done(c) ? "ok" : ""}`}>
                {c.key === "crack:ctf"
                  ? `${st.solved}/${LEVELS} levels cracked (L5 is a bonus)`
                  : done(c) ? "cracked" : "not yet"}
              </span>
              <Link href={c.href} className="start-btn">{started(c) ? "Continue" : "Start"}</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
