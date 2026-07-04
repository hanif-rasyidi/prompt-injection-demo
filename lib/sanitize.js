// ─────────────────────────────────────────────────────────────────────────────
// Two of the four hardening layers, as standalone, nameable functions you can
// point at on stage.
// ─────────────────────────────────────────────────────────────────────────────

import { ALLOWED_HOSTS } from "./config.js";

// LAYER 1 — INPUT DELIMITING
// Why it exists: "We label untrusted content so the model knows what is data and
// what is a command." Maps to OWASP LLM01 mitigation: segregate external content.
// We also strip any closing tag the attacker included, so they can't "break out"
// of the fence and smuggle instructions back into the trusted zone.
export function wrapUntrusted(ticket) {
  const escaped = String(ticket).replaceAll("</untrusted_ticket>", "");
  return `<untrusted_ticket>\n${escaped}\n</untrusted_ticket>`;
}

// LAYER 3 — OUTPUT / LINK ALLOWLISTING  (the real backstop)
// Why it exists: "Even if the model is fooled, the stolen data physically can't
// leave — any URL to a non-approved host is neutralised before it reaches the
// browser." Maps to OWASP LLM01: restrict outbound / egress filtering.
// This does NOT trust the model at all; it filters the model's OUTPUT.
const MD_IMAGE = /!\[([^\]]*)\]\(([^)]+)\)/g; // ![alt](url)  -> auto-loads
const MD_LINK = /\[([^\]]*)\]\(([^)]+)\)/g; //  [text](url)  -> click

function hostAllowed(url) {
  try {
    const h = new URL(url, "https://acme-saas.example.com").hostname;
    return ALLOWED_HOSTS.includes(h);
  } catch {
    return false;
  }
}

function hostOf(url) {
  try {
    return new URL(url, "https://x.invalid").hostname || "unknown";
  } catch {
    return "unknown";
  }
}

export function allowlistOutput(markdown) {
  let blocked = 0;
  const clean = String(markdown)
    // images first (they contain the same [..](..) shape as links)
    .replace(MD_IMAGE, (m, _alt, url) => {
      if (hostAllowed(url)) return m;
      blocked++;
      return `\`🚫 blocked image → ${hostOf(url)}\``;
    })
    .replace(MD_LINK, (m, text, url) => {
      if (hostAllowed(url)) return m;
      blocked++;
      return `${text} \`🚫 blocked link → ${hostOf(url)}\``;
    });
  return { clean, blocked };
}

// HONEST LIMITATION (say this on stage): this regex catches INLINE markdown only.
// Reference-style markdown (![a][ref] + [ref]: url) — the exact trick EchoLeak
// used to dodge link redaction — would slip past naive output filtering. That's
// why real systems back this with a strict Content-Security-Policy at the browser,
// not just string filtering. Layer 3 raises the bar hard; it is not a force field.
