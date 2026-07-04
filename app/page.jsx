import Link from "next/link";

const SCENARIOS = [
  { href: "/support", tag: "①", title: "Public Support Chatbot", type: "Direct injection",
    blurb: "A visitor talks to the bot and types attacks to extract its session reference code. The attacker IS the user." },
  { href: "/docs", tag: "②", title: "Ask the Docs (RAG)", type: "Indirect via document",
    blurb: "A normal question retrieves a community-submitted article — which hides instructions the assistant obeys." },
  { href: "/console", tag: "③", title: "Internal Agent Console", type: "Human review bypassed",
    blurb: "An agent approves a clean-looking ticket. The AI reads the raw source — with an invisible payload — and leaks." },
  { href: "/ops", tag: "④", title: "Auto-Triage Automation", type: "Zero-click",
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

      <div className="grid2">
        {SCENARIOS.map((s) => (
          <Link key={s.href} href={s.href} className="panel" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}><span className="muted">{s.tag}</span> {s.title}</h2>
              <span className="tag danger">{s.type}</span>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>{s.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
