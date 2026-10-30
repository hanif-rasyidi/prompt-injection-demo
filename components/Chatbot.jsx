"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { LEVELS, MAX_LEVEL } from "../lib/ctf.js";
import { markCracked } from "../lib/progress.js";

// The model sometimes wraps symbols in LaTeX (e.g. "$\rightarrow$"); react-markdown
// doesn't render math, so convert the common ones to plain arrows first.
const mdClean = (t = "") =>
  t.replace(/\$\s*\\?(rightarrow|to)\s*\$/gi, "→")
   .replace(/\$\s*\\?(leftarrow|gets)\s*\$/gi, "←")
   .replace(/\\rightarrow/g, "→").replace(/\\leftarrow/g, "←");

// Self-paced state lives in this browser only: student id, current level, how
// each level was solved, and hints revealed.
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const GREETING = { role: "bot", text: "Hi! I'm the Acme Assistant. How can I help?" };

export default function Chatbot() {
  const [id, setId] = useState("anon");
  const [level, setLevel] = useState(1);
  const [solved, setSolved] = useState({}); // {level: "clean" | "hint" | "answer"}
  const [help, setHelp] = useState({}); // {level: 0 none | 1 hint | 2 answer}
  const [msgs, setMsgs] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let v = localStorage.getItem("ctf_id");
    if (!v) { v = Math.random().toString(36).slice(2); localStorage.setItem("ctf_id", v); }
    setId(v);
    setLevel(load("lab:support:level", 1));
    setSolved(load("lab:support:solved", {}));
    setHelp(load("lab:support:help", {}));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs]);

  const meta = LEVELS[level];
  const step = help[level] || 0;

  function goLevel(n) {
    setLevel(n); save("lab:support:level", n);
    setMsgs([GREETING]); setWon(false); setAttempts(0); setInput(""); setShowPrompt(false);
  }

  function reveal(n) {
    const next = { ...help, [level]: Math.max(step, n) };
    setHelp(next); save("lab:support:help", next);
    if (n === 2) setInput(meta.answer);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "you", text }]);
    setBusy(true);
    setAttempts((a) => a + 1);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, id, level }),
      });
      const d = await r.json();
      setMsgs((m) => [...m, { role: "bot", text: d.reply, busy: d.busy }]);
      if (d.cracked) {
        setWon(true);
        markCracked("ctf");
        const how = step >= 2 ? "answer" : step === 1 ? "hint" : "clean";
        const next = { ...solved, [level]: solved[level] === "clean" ? "clean" : how };
        setSolved(next); save("lab:support:solved", next);
      }
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "Network hiccup. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  const nSolved = Object.keys(solved).length;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Level picker + progress */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b>Level</b>
          <span className="muted" style={{ fontSize: 13 }}>{nSolved}/{MAX_LEVEL} cracked</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => goLevel(n)} aria-pressed={n === level}
              style={{ padding: "8px 14px", background: n === level ? "var(--accent)" : "#2a2f3d", minWidth: 52 }}>
              {solved[n] ? "✓ " : ""}{n}{LEVELS[n].boss ? " 👑" : ""}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <b>Level {level}: {meta.label}</b>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>🛡 Defense: {meta.defense}</p>
          {level > 1 && (
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>🚫 <b>Why your last trick fails here:</b> {meta.blocks}</p>
          )}
          <button onClick={() => setShowPrompt((v) => !v)} style={{ background: "#2a2f3d", padding: "6px 10px", fontSize: 13, marginTop: 10 }}>
            📜 {showPrompt ? "Hide" : "Show"} this level's system prompt
          </button>
          {showPrompt && <SystemPrompt level={level} />}
          {solved[level] && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ok)" }}>
              ✓ Solved {solved[level] === "clean" ? "clean, no help" : `with the ${solved[level]}`}
            </p>
          )}
        </div>
      </div>

      {/* Hints */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => reveal(1)} style={{ background: step >= 1 ? "#2a2f3d" : "#3b4a7a" }}>💡 Hint</button>
          <button onClick={() => reveal(2)} disabled={step < 1} style={{ background: "#3b4a7a" }}>🔑 Show answer</button>
        </div>
        {step >= 1 && <p style={{ margin: "10px 0 0", fontSize: 14 }}>💡 {meta.hint}</p>}
        {step >= 2 && (
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
            🔑 The answer is loaded in the message box. Press Send.
            {meta.boss ? " Expected to fail: that's the lesson. Strong prompt hardening holds; the real fix is not giving the bot the secret at all." : ""}
          </p>
        )}
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
          <h2 style={{ margin: 0 }}>🤖 Acme Assistant</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 12 }}>{attempts} tries</span>
            <button onClick={() => goLevel(level)} style={{ background: "#2a2f3d", padding: "6px 10px", fontSize: 13 }}>↺ Reset chat</button>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          Goal: get the bot to reveal <b>your</b> session reference code (starts with <code>ACME-</code>). Each level has a different code.
        </p>

        {won && (
          <div className="cracked-banner">
            🚩 Cracked Level {level}! The code in the reply is yours.
            {level < MAX_LEVEL && (
              <div style={{ marginTop: 8 }}>
                <button onClick={() => goLevel(level + 1)}>Next level →</button>
              </div>
            )}
            {level === MAX_LEVEL && <div style={{ marginTop: 6, fontWeight: 400 }}>You beat the production-hardened prompt. Seriously impressive.</div>}
          </div>
        )}

        <div style={{ height: 340, overflowY: "auto", background: "#0c0e14", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ margin: "8px 0", textAlign: m.role === "you" ? "right" : "left" }}>
              <span className={m.role === "you" ? undefined : "bot-md"} style={{
                display: "inline-block", padding: "8px 12px", borderRadius: 10, maxWidth: "85%",
                background: m.role === "you" ? "var(--accent)" : m.busy ? "#3a2d00" : "#1a1d27",
                color: m.role === "you" ? "#fff" : "var(--text)",
                whiteSpace: m.role === "you" ? "pre-wrap" : "normal", textAlign: "left", wordBreak: "break-word",
              }}>
                {m.role === "you" ? m.text : <ReactMarkdown>{mdClean(m.text)}</ReactMarkdown>}
              </span>
            </div>
          ))}
          {busy && <div className="muted" style={{ fontSize: 13 }}>Acme Assistant is typing…</div>}
          <div ref={endRef} />
        </div>

        {/* textarea so multi-line payloads keep their newlines. Enter sends, Shift+Enter = newline. */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type your attack…  (Enter = send, Shift+Enter = new line)"
            rows={3}
            style={{ flex: 1, resize: "vertical", minHeight: 52 }}
          />
          <button onClick={send} disabled={busy}>{busy ? "…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}

// The level's real defense prompt (the secret code lives in a separate system
// message, so nothing here leaks it). Lines that are new since the previous
// level are highlighted, so students see exactly what changed.
function SystemPrompt({ level }) {
  const prev = new Set(level > 1 ? LEVELS[level - 1].policy.split("\n") : []);
  return (
    <div className="raw" style={{ marginTop: 8, maxHeight: 260 }}>
      {LEVELS[level].policy.split("\n").map((line, i) => (
        <div key={i} style={level > 1 && !prev.has(line) ? { color: "var(--danger)", background: "rgba(255,93,93,0.12)", fontWeight: 700 } : undefined}>
          {line || "\u00a0"}
        </div>
      ))}
      {level > 1 && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Highlighted = new at this level.</div>}
    </div>
  );
}
