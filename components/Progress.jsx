"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCracked, CHALLENGES } from "../lib/progress.js";

export default function Progress() {
  const [c, setC] = useState(null);
  useEffect(() => {
    const f = () => setC(getCracked());
    f();
    window.addEventListener("crack", f);
    window.addEventListener("storage", f);
    return () => { window.removeEventListener("crack", f); window.removeEventListener("storage", f); };
  }, []);

  if (!c) return null; // don't render server-side (avoids hydration mismatch)
  const n = CHALLENGES.filter((x) => c[x.key]).length;

  return (
    <div className="panel" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <b style={{ fontSize: 15 }}>🏆 {n === 3 ? "All surfaces cracked!" : `Your progress: ${n}/3 cracked`}</b>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {CHALLENGES.map((x) => (
          <Link key={x.key} href={x.href} className={`tag ${c[x.key] ? "ok" : ""}`}
            style={{ textDecoration: "none", border: c[x.key] ? "none" : "1px solid var(--border)" }}>
            {c[x.key] ? "✓" : "○"} {x.label}
          </Link>
        ))}
      </div>
      {n === 3 && <span className="muted" style={{ fontSize: 13 }}>You ran the full attack ladder — direct, indirect, and exfiltration. 🎉</span>}
    </div>
  );
}
