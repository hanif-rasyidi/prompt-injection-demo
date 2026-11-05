// Client-side progress across the three hands-on challenges (localStorage only —
// no server, no accounts). Lets the landing show "N/3 cracked" and each win
// celebrate. Fires a "crack" event so an open Progress badge updates live.
const KEYS = { ctf: "crack:ctf", docs: "crack:docs", ticket: "crack:ticket" };

export const CHALLENGES = [
  { key: "ctf", label: "① Chatbot", href: "/support" },
  { key: "docs", label: "② Docs", href: "/docs" },
  { key: "ticket", label: "③ Exfil", href: "/console" },
];

export function markCracked(key) {
  try {
    if (localStorage.getItem(KEYS[key]) === "1") return;
    localStorage.setItem(KEYS[key], "1");
    window.dispatchEvent(new Event("crack"));
  } catch {}
}

export function getCracked() {
  const out = {};
  for (const k in KEYS) {
    try { out[k] = localStorage.getItem(KEYS[k]) === "1"; } catch { out[k] = false; }
  }
  return out;
}

// The per-browser student id (same key the chatbot and docs heist use).
export function studentId() {
  try {
    let v = localStorage.getItem("ctf_id");
    if (!v) { v = Math.random().toString(36).slice(2); localStorage.setItem("ctf_id", v); }
    return v;
  } catch { return ""; }
}
