// Per-student secrets. Every flag and vault value is derived server-side as
// HMAC(salt, studentId + scope), so it is stable for that student, different for
// everyone else, and never sent to the browser until the model leaks it.
// Knowing a classmate's flag does you no good.
import { createHmac } from "node:crypto";

const SALT = process.env.FLAG_SALT || process.env.LLM_API_KEY || "acme-lab-local-salt";

const WORDS = ["SUNRISE", "GLACIER", "FALCON", "QUARTZ", "COMET", "NEBULA", "CIPHER", "VORTEX", "EMBER", "ONYX", "HARBOR", "MAPLE"];
const B32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function digest(id, scope) {
  return createHmac("sha256", SALT).update(`${id}|${scope}`).digest();
}

// n chars from an unambiguous alphabet, deterministic for (id, scope).
export function code(id, scope, n = 4) {
  const d = digest(id, scope);
  let out = "";
  for (let i = 0; i < n; i++) out += B32[d[i] % B32.length];
  return out;
}

// ① flag, e.g. ACME-FALCON-4821. One per student per level.
export function supportFlag(id, level) {
  const d = digest(id, `support:${level}`);
  return `ACME-${WORDS[d[0] % WORDS.length]}-${1000 + (d.readUInt16BE(1) % 9000)}`;
}

// Normalised containment: strip separators and case so "A-C-M-E…" or a
// URL-encoded leak still counts.
export const norm = (t) => String(t ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
export function contains(haystack, secret) {
  const s = norm(secret);
  if (!s) return false;
  if (norm(haystack).includes(s)) return true;
  try { return norm(decodeURIComponent(haystack)).includes(s); } catch { return false; }
}

// Clean a student id from the request body.
export const cleanId = (v) => String(v ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 32) || "anon";
