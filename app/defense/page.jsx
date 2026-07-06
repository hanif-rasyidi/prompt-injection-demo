// The "Defense" half of "From Attack to Defense" — the teaching close. Recaps the
// four attack surfaces, the four hardening layers (with the honest limits of each),
// and the one thesis to leave the room with. Static content; safe to project.

const ATTACKS = [
  { tag: "①", name: "Public chatbot", cls: "Direct injection", lesson: "The user IS the attacker. Prompt hardening raises the bar level by level — but each layer is bypassable (creative framing → language switch → completion injection), and only real architecture stops the last mile." },
  { tag: "②", name: "Ask the Docs (RAG)", cls: "Indirect injection", lesson: "The attacker never talks to the bot — they poison a document it will retrieve. Treat ALL retrieved / external content as untrusted data, never as instructions." },
  { tag: "③", name: "Agent console", cls: "Human-review bypass", lesson: "The human approves the rendered email; the AI reads the raw source with an invisible payload. Review the same bytes the model sees — and filter egress, because the human can't catch what they can't see." },
  { tag: "④", name: "Auto-triage", cls: "Zero-click", lesson: "No human at all. Automation removes the last safety net: a crafted email is processed and exfiltrated with zero clicks. Least privilege + egress filtering are non-negotiable here." },
];

const LAYERS = [
  { n: "L1", name: "Input delimiting", does: "Wrap untrusted content in tags so the model knows what is data vs. command; strip attacker-inserted closing tags.", not: "A model that decides to ignore the fence still can. Delimiting is hygiene, not a wall." },
  { n: "L2", name: "Instruction hierarchy", does: "A system prompt declaring the security policy outranks any ticket/doc/message, with explicit anti-override rules.", not: "Probabilistic, not guaranteed — a prompt is a policy, not a barrier (cf. Bing 'Sydney'). A weaker model or a novel framing still slips through." },
  { n: "L3", name: "Output / link allowlisting", does: "Filter the MODEL'S OUTPUT: any URL/image whose host isn't on the allowlist is neutralised before it reaches the browser. The real egress backstop.", not: "Catches inline markdown only. Reference-style links and non-URL channels can dodge naive filtering — back it with a strict browser Content-Security-Policy." },
  { n: "L4", name: "Token / rate cap", does: "Reject oversized inputs and bound per-session cost — stops context-flooding and cost-abuse.", not: "A small, clever payload sails right under the cap. It bounds blast radius; it doesn't detect intent." },
];

export default function DefensePage() {
  return (
    <div className="container">
      <h1>🛡 From Attack to Defense</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        We turned Acme's own AI against it four ways. Here's what each one teaches, the layers that
        push back, and the honest limits of every layer.
      </p>

      {/* attack recap */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <h2>The four surfaces we broke</h2>
        {ATTACKS.map((a) => (
          <div key={a.tag} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <b style={{ fontSize: 15 }}>{a.tag} {a.name}</b>
              <span className="tag danger">{a.cls}</span>
            </div>
            <p className="muted" style={{ margin: "6px 0 0" }}>{a.lesson}</p>
          </div>
        ))}
      </div>

      {/* defense layers */}
      <h2>The four hardening layers — and what each does NOT protect</h2>
      <div className="grid2" style={{ marginBottom: 18 }}>
        {LAYERS.map((l) => (
          <div key={l.n} className="panel">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="tag ok">{l.n}</span> <b style={{ fontSize: 15 }}>{l.name}</b>
            </div>
            <p style={{ margin: "8px 0 6px", fontSize: 14 }}>✅ {l.does}</p>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>⚠ Does not protect: {l.not}</p>
          </div>
        ))}
      </div>

      {/* thesis */}
      <div className="panel" style={{ background: "linear-gradient(135deg,#141a2e,#1a1d27)" }}>
        <h2 style={{ marginTop: 0 }}>The one thing to leave with</h2>
        <p style={{ fontSize: 16, maxWidth: 760 }}>
          A prompt is a <b>policy, not a wall.</b> You cannot reliably instruct a model out of being
          manipulated — defenses that live inside the prompt are probabilistic. The wall is what the
          model <i>physically cannot do</i>:
        </p>
        <ul style={{ fontSize: 15, lineHeight: 1.8 }}>
          <li><b>Filter the output / egress</b> — stolen data can't leave if the URL is neutralised (L3 + CSP).</li>
          <li><b>Least privilege</b> — don't give the model secrets, tokens, or tools it doesn't strictly need.</li>
          <li><b>Assume every external byte is hostile</b> — tickets, docs, emails, retrieved content: data, never instructions.</li>
        </ul>
        <p className="muted" style={{ marginBottom: 0 }}>
          Layers 1–4 raise the cost of an attack enormously — stack them. But the guarantee comes from
          architecture, not persuasion.
        </p>
      </div>
    </div>
  );
}
