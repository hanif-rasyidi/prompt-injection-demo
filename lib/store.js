// Server-side state for the self-paced lab. Upstash Redis when configured (so
// limits and captures hold across Vercel's serverless instances), in-memory
// otherwise (local dev). Nothing here is shared between students: every key is
// scoped to one student id, except the rate limit per IP and the daily budget.
// Progress, hints, attempts and ② planted articles live in the browser.

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(URL_ && TOK);
export const STORE = useRedis ? "redis" : "memory";

const mem = globalThis.__lab ?? (globalThis.__lab = { kv: new Map() });

async function redis(...cmd) {
  const r = await fetch(`${URL_}/${cmd.map((c) => encodeURIComponent(String(c))).join("/")}`, {
    headers: { Authorization: `Bearer ${TOK}` },
    cache: "no-store",
  });
  return (await r.json()).result;
}

// Tiny in-memory KV with expiry, same semantics as the Redis calls we use.
function memGet(k) {
  const e = mem.kv.get(k);
  if (!e) return undefined;
  if (e.exp && e.exp < Date.now()) { mem.kv.delete(k); return undefined; }
  return e.v;
}
function memSet(k, v, ttlS) {
  const prev = mem.kv.get(k);
  mem.kv.set(k, { v, exp: ttlS ? Date.now() + ttlS * 1000 : prev?.exp });
}

// ── Rate limit: fixed window counter ───────────────────────────────────────
export async function hit(key, limit, windowS) {
  const k = `rl:${key}`;
  if (!useRedis) {
    const n = (memGet(k) || 0) + 1;
    memSet(k, n, memGet(k) === undefined ? windowS : undefined);
    return n <= limit;
  }
  const n = await redis("incr", k);
  if (n === 1) await redis("expire", k, windowS);
  return n <= limit;
}

// ── Daily global token budget ──────────────────────────────────────────────
const dayKey = () => `budget:${new Date().toISOString().slice(0, 10)}`;

export async function tokensUsedToday() {
  if (!useRedis) return memGet(dayKey()) || 0;
  return Number(await redis("get", dayKey())) || 0;
}

export async function addTokens(n) {
  if (!n) return;
  if (!useRedis) { memSet(dayKey(), (memGet(dayKey()) || 0) + n, 2 * 86400); return; }
  await redis("incrby", dayKey(), n);
  await redis("expire", dayKey(), 2 * 86400);
}

// ── Exfil captures, one private list per student ───────────────────────────
const CAP_TTL = 6 * 3600;
const capKey = (sid) => `cap:${sid}`;

export async function pushCapture(sid, data) {
  const entry = { at: new Date().toISOString(), data: String(data).slice(0, 2000) };
  if (!useRedis) {
    const arr = [entry, ...(memGet(capKey(sid)) || [])].slice(0, 20);
    memSet(capKey(sid), arr, CAP_TTL);
    return;
  }
  await redis("lpush", capKey(sid), JSON.stringify(entry));
  await redis("ltrim", capKey(sid), 0, 19);
  await redis("expire", capKey(sid), CAP_TTL);
}

export async function getCaptures(sid) {
  if (!useRedis) return memGet(capKey(sid)) || [];
  const arr = await redis("lrange", capKey(sid), 0, 19);
  return (arr || []).map((s) => { try { return JSON.parse(s); } catch { return { at: "", data: s }; } });
}

export async function clearCaptures(sid) {
  if (!useRedis) { mem.kv.delete(capKey(sid)); return; }
  await redis("del", capKey(sid));
}
