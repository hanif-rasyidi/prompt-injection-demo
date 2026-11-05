import Link from "next/link";
import Scenarios from "../components/Scenarios.jsx";

export default function Home() {
  return (
    <div className="container">
      <div className="panel" style={{ marginBottom: 20, background: "linear-gradient(135deg,#141a2e,#1a1d27)" }}>
        <h1 style={{ fontSize: 34 }}>Acme SaaS prompt-injection lab</h1>
        <p style={{ maxWidth: 640, marginBottom: 0 }}>
          A safe, fully synthetic lab you work through on your own, any time. Four scenarios, four ways to turn an AI against its owner.
        </p>
      </div>

      <Scenarios />

      <Link href="/defense" className="panel" style={{
        display: "block", marginTop: 16, textDecoration: "none", color: "inherit",
        background: "linear-gradient(135deg,#141a2e,#1a1d27)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h2 style={{ margin: 0 }}>🛡 From Attack to Defense — the takeaways</h2>
          <span className="tag ok">wrap-up</span>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          The four hardening layers, the honest limit of each, and the one thing to leave with.
        </p>
      </Link>
    </div>
  );
}
