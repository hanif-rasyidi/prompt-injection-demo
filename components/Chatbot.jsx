"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { markCracked } from "../lib/progress.js";

// The model sometimes wraps symbols in LaTeX (e.g. "$\rightarrow$"); react-markdown
// doesn't render math, so convert the common ones to plain arrows first.
const mdClean = (t = "") =>
  t.replace(/\$\s*\\?(rightarrow|to)\s*\$/gi, "→")
   .replace(/\$\s*\\?(leftarrow|gets)\s*\$/gi, "←")
   .replace(/\\rightarrow/g, "→").replace(/\\leftarrow/g, "←");

function useParticipantId() {
  const [id, setId] = useState("anon");
  useEffect(() => {
    let v = localStorage.getItem("ctf_id");
    if (!v) { v = Math.random().toString(36).slice(2); localStorage.setItem("ctf_id", v); }
    setId(v);
  }, []);
  return id;
}

export default function Chatbot() {
  const id = useParticipantId();
  const [level, setLevel] = useState(1);
  const [msgs, setMsgs] = useState([{ role: "bot", text: "Hi! I'm the Acme Assistant. How can I help?" }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const endRef = useRef(null);

  // follow the presenter's current level
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/level");
        const d = await r.json();
        setLevel((prev) => { if (d.level !== prev) setWon(false); return d.level; });
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "you", text }]);
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, id }),
      });
      const d = await r.json();
      setMsgs((m) => [...m, { role: "bot", text: d.reply }]);
      if (d.cracked) { setWon(true); markCracked("ctf"); }
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "Network hiccup — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>🤖 Acme Assistant</h2>
        <span className="tag danger">LEVEL {level}</span>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Goal: get the bot to reveal its <b>session reference code</b> (starts with <code>ACME-</code>).
      </p>

      {won && (
        <div className="cracked-banner">🚩 Cracked Level {level}! You extracted the code — tell the presenter. 🎉</div>
      )}

      <div style={{ height: 320, overflowY: "auto", background: "#0c0e14", border: "1px solid var(--border)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ margin: "8px 0", textAlign: m.role === "you" ? "right" : "left" }}>
            <span className={m.role === "you" ? undefined : "bot-md"} style={{
              display: "inline-block", padding: "8px 12px", borderRadius: 10, maxWidth: "85%",
              background: m.role === "you" ? "var(--accent)" : "#1a1d27",
              color: m.role === "you" ? "#fff" : "var(--text)",
              whiteSpace: m.role === "you" ? "pre-wrap" : "normal", textAlign: "left",
            }}>
              {m.role === "you" ? m.text : <ReactMarkdown>{mdClean(m.text)}</ReactMarkdown>}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* textarea (not input) so multi-line payloads — transcripts, fake system
          blocks, floods — keep their newlines. Enter sends, Shift+Enter = newline. */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type your question…  (Enter = send, Shift+Enter = new line)"
          rows={2}
          style={{ flex: 1, resize: "vertical", minHeight: 46 }}
        />
        <button onClick={send} disabled={busy}>{busy ? "…" : "Send"}</button>
      </div>
    </div>
  );
}
