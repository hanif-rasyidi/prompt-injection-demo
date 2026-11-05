"use client";

// Shared win celebration for every scenario: banner, small confetti, the leaked
// secrets, why it worked, which defense stops it, and the defense-flip next step.
const BITS = ["🎉", "✨", "🚩", "🎊", "⭐", "🎉", "✨", "🎊"];

export default function WinCard({ title, secrets = [], why, stops, defensesOn, onFlip, next }) {
  return (
    <div className="cracked-banner win-card" role="status">
      <div className="confetti" aria-hidden="true">
        {BITS.map((b, i) => <span key={i} style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 0.06}s` }}>{b}</span>)}
      </div>
      <div>🚩 {title}</div>
      {secrets.length > 0 && (
        <div style={{ margin: "8px 0", fontWeight: 400 }}>
          {secrets.map((s, i) => <span key={i} className="tag danger" style={{ marginRight: 6, marginBottom: 6, display: "inline-block" }}>🩸 {s}</span>)}
        </div>
      )}
      {why && <p style={{ margin: "8px 0 0", fontWeight: 400, fontSize: 14 }}><b>Why it worked:</b> {why}</p>}
      {stops && <p style={{ margin: "6px 0 0", fontWeight: 400, fontSize: 14 }}><b>What stops it:</b> {stops}</p>}
      {(onFlip || next) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {onFlip && !defensesOn && <button onClick={onFlip}>🛡 Turn Defenses ON and replay</button>}
          {next}
        </div>
      )}
    </div>
  );
}
