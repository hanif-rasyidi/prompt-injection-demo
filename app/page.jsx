import Link from "next/link";
import Progress from "../components/Progress.jsx";

const SCENARIOS = [
  { href: "/support", tag: "①", title: "Public Support Chatbot", type: "Direct injection", play: "hands-on",
    blurb: "A visitor talks to the bot and types attacks to extract its session reference code. The attacker IS the user." },
  { href: "/docs", tag: "②", title: "Ask the Docs (RAG)", type: "Indirect via document", play: "hands-on",
    blurb: "A normal question retrieves a community-submitted article — which hides instructions the assistant obeys." },
  { href: "/console", tag: "③", title: "Internal Agent Console", type: "Human review bypassed", play: "hands-on",
    blurb: "An agent approves a clean-looking ticket. The AI reads the raw source — with an invisible payload — and leaks." },
  { href: "/ops", tag: "④", title: "Auto-Triage Automation", type: "Zero-click", play: "demo",
    blurb: "No human at all. An incoming ticket is auto-processed and exfiltrated. The purest EchoLeak." },
];

export default function Home() {
  return (
    <div className="container">
      <div className="panel" style={{ marginBottom: 20, background: "linear-gradient(135deg,#141a2e,#1a1d27)" }}>
        <div className="muted" style={{ fontSize: 13 }}>AIBC 2026 · live demo</div>
        <h1 style={{ fontSize: 34 }}>Acme SaaS</h1>
        <p style={{ maxWidth: 640 }}>
          The AI-powered support platform we shipped fast. It has a public chatbot, an AI docs
          assistant, an internal agent console, and automated triage. Four surfaces — and four ways
          an attacker can turn our own AI against us.
        </p>
        <p className="muted">From Attack to Defense: a practical guide to prompt injection.</p>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <b style={{ fontSize: 15 }}>▶ How to play</b>
        <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
          <b>1.</b> Open a surface on your phone. &nbsp;<b>2.</b> Try to make the AI misbehave — each
          hands-on has a 💡 <b>Hint</b> if you're stuck. &nbsp;<b>3.</b> Flip <b>Defenses ON</b> and watch
          your attack stop. Crack all three 🙌 surfaces below.
        </div>
      </div>

      <Progress />

      <div className="grid2">
        {SCENARIOS.map((s) => {
          const inner = (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0 }}><span className="muted">{s.tag}</span> {s.title}</h2>
                <span className={`tag ${s.soon ? "" : "danger"}`}>{s.soon ? "🔒 coming soon" : s.type}</span>
              </div>
              <p className="muted" style={{ margin: "0 0 8px" }}>{s.blurb}</p>
              <span className="tag ok" style={{ opacity: s.play === "hands-on" ? 1 : 0.6 }}>
                {s.play === "hands-on" ? "🙌 hands-on — you attack it" : "▶ live demo"}
              </span>
            </>
          );
          return s.soon ? (
            <div key={s.href} className="panel" style={{ opacity: 0.55, cursor: "default" }}>{inner}</div>
          ) : (
            <Link key={s.href} href={s.href} className="panel" style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
          );
        })}
      </div>

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
