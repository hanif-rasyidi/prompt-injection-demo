// Per-student ① flag. HMAC(student id + level), so every student gets their own
// code per level, stable across retries, and never sent to the browser until the
// model leaks it. Server-only (node:crypto).
import { createHmac } from "node:crypto";

const SALT = process.env.FLAG_SALT || process.env.LLM_API_KEY || "acme-lab-local-salt";
const WORDS = ["SUNRISE", "GLACIER", "FALCON", "QUARTZ", "COMET", "NEBULA", "CIPHER", "VORTEX", "EMBER", "ONYX"];

export function studentFlag(id, level) {
  const d = createHmac("sha256", SALT).update(`${id}|support:${level}`).digest();
  return `ACME-${WORDS[d[0] % WORDS.length]}-${1000 + (d.readUInt16BE(1) % 9000)}`;
}
