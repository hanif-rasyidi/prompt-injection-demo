import Link from "next/link";

// Top navigation for the fake "Acme SaaS" product. One brand, four attack
// surfaces + the attacker's capture log.
const LINKS = [
  { href: "/", label: "Acme SaaS", brand: true },
  { href: "/support", label: "Support", tag: "①" },
  { href: "/docs", label: "Ask the Docs", tag: "②" },
  { href: "/console", label: "Agent Console", tag: "③" },
  { href: "/ops", label: "Auto-Triage", tag: "④" },
  { href: "/attacker", label: "🚨 Attacker Log", danger: true },
];

export default function Nav() {
  return (
    <nav className="nav">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`nav-link${l.brand ? " nav-brand" : ""}${l.danger ? " nav-danger" : ""}`}
        >
          {l.tag ? <span className="nav-tag">{l.tag}</span> : null}
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
