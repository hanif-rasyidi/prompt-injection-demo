// Shared CTF state: the presenter-controlled level + its current (random) flag,
// plus per-participant throttle. Upstash Redis when configured (deployed multi-user
// session); in-memory fallback for local dev.
// ponytail: in-memory is fine locally; Upstash only needed for the live 100-user deploy.

import { makeFlag } from "./ctf.js";

const mem = globalThis.__ctf ?? (globalThis.__ctf = { level: 1, flag: makeFlag(), hits: new Map() });
// Accept either the native Upstash names or Vercel's KV integration names.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(URL_ && TOK);
export const STORE = useRedis ? "redis" : "memory";

async function redis(...cmd) {
  const r = await fetch(`${URL_}/${cmd.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${TOK}` },
    cache: "no-store",
  });
  return (await r.json()).result;
}

// { level, flag }. Flag is server-side only — never exposed to participants.
export async function getState() {
  if (!useRedis) return { level: mem.level, flag: mem.flag };
  const [level, flag] = await Promise.all([redis("get", "ctf:level"), redis("get", "ctf:flag")]);
  if (!flag) return setLevel(1); // initialise on first use
  return { level: Number(level) || 1, flag };
}

// Changing level always mints a NEW flag (fresh challenge).
export async function setLevel(n) {
  const flag = makeFlag();
  if (!useRedis) { mem.level = n; mem.flag = flag; return { level: n, flag }; }
  await redis("set", "ctf:level", String(n));
  await redis("set", "ctf:flag", flag);
  return { level: n, flag };
}

// ── Scenario ③/④ exfiltration capture log ──────────────────────────────────
// Redis-backed so captures survive across Vercel's stateless serverless instances
// (in-memory only works within one process — fine for local dev).
const CAP_KEY = "exfil:captures";
const capMem = globalThis.__captures ?? (globalThis.__captures = []);

export async function pushCapture(data) {
  const entry = { at: new Date().toISOString(), data };
  if (!useRedis) { capMem.unshift(entry); if (capMem.length > 50) capMem.pop(); return; }
  await redis("lpush", CAP_KEY, JSON.stringify(entry));
  await redis("ltrim", CAP_KEY, "0", "49");
}

export async function getCaptures() {
  if (!useRedis) return capMem;
  const arr = await redis("lrange", CAP_KEY, "0", "49");
  return (arr || []).map((s) => { try { return JSON.parse(s); } catch { return { at: "", data: s }; } });
}

export async function clearCaptures() {
  if (!useRedis) { capMem.length = 0; return; }
  await redis("del", CAP_KEY);
}

// max `limit` requests per `windowS` seconds per participant id.
export async function allow(id, limit = 4, windowS = 8) {
  if (!useRedis) {
    const now = Date.now();
    const arr = (mem.hits.get(id) || []).filter((t) => now - t < windowS * 1000);
    if (arr.length >= limit) return false;
    arr.push(now);
    mem.hits.set(id, arr);
    return true;
  }
  const key = `ctf:rl:${id}`;
  const n = await redis("incr", key);
  if (n === 1) await redis("expire", key, String(windowS));
  return n <= limit;
}
