// Per-participant throttle, exfil captures and ② planted articles. Upstash Redis when configured (deployed multi-user
// session); in-memory fallback for local dev.
// ponytail: in-memory is fine locally; Upstash only needed for the live 100-user deploy.

const mem = globalThis.__ctf ?? (globalThis.__ctf = { hits: new Map() });
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

// ── Scenario ③/④ exfiltration capture log ──────────────────────────────────
// Redis-backed so captures survive across Vercel's stateless serverless instances
// (in-memory only works within one process — fine for local dev).
// Captures are private per student id (1 hour TTL), so nobody sees another student's exfil.
const CAP_TTL = 3600;
const CAP_MAX = 50;
const capMem = globalThis.__captures ?? (globalThis.__captures = new Map()); // id -> { exp, list }
const capKey = (id) => `exfil:captures:${id}`;

export async function pushCapture(id, data, from = "") {
  const entry = { at: new Date().toISOString(), data, from };
  if (!useRedis) {
    const cur = capMem.get(id);
    const list = cur && cur.exp > Date.now() ? cur.list : [];
    list.unshift(entry);
    capMem.set(id, { exp: Date.now() + CAP_TTL * 1000, list: list.slice(0, CAP_MAX) });
    return;
  }
  await redis("lpush", capKey(id), JSON.stringify(entry));
  await redis("ltrim", capKey(id), "0", String(CAP_MAX - 1));
  await redis("expire", capKey(id), String(CAP_TTL));
}

export async function getCaptures(id) {
  if (!id) return [];
  if (!useRedis) {
    const cur = capMem.get(id);
    return cur && cur.exp > Date.now() ? cur.list : [];
  }
  const arr = await redis("lrange", capKey(id), "0", String(CAP_MAX - 1));
  return (arr || []).map((s) => { try { return JSON.parse(s); } catch { return { at: "", data: s }; } });
}

export async function clearCaptures(id) {
  if (!id) return;
  if (!useRedis) { capMem.delete(id); return; }
  await redis("del", capKey(id));
}

// ── Scenario ② "Your turn" — planted articles per attendee ──────────────────
// The heist lets an attendee plant one or more poisoned wiki articles that persist
// across their questions (so a dormant keyword backdoor survives an innocent question
// and fires on the trigger one). Keyed by browser id; Redis when configured, in-memory
// otherwise — same pattern as captures. Small caps: an article is a demo payload.
const PLANT_MAX = 5;
const plantMem = globalThis.__planted ?? (globalThis.__planted = new Map());
const plantKey = (id) => `docs:planted:${id}`;

export async function plantArticle(id, article) {
  const entry = {
    title: String(article.title ?? "Community tip").slice(0, 120),
    body: String(article.body ?? "").slice(0, 4000),
    trigger: String(article.trigger ?? "").slice(0, 60),
    at: new Date().toISOString(),
  };
  if (!useRedis) {
    const arr = plantMem.get(id) || [];
    arr.push(entry);
    plantMem.set(id, arr.slice(-PLANT_MAX));
    return plantMem.get(id);
  }
  await redis("rpush", plantKey(id), JSON.stringify(entry));
  await redis("ltrim", plantKey(id), String(-PLANT_MAX), "-1");
  return getPlanted(id);
}

export async function getPlanted(id) {
  if (!useRedis) return plantMem.get(id) || [];
  const arr = await redis("lrange", plantKey(id), "0", "-1");
  return (arr || []).map((s) => { try { return JSON.parse(s); } catch { return { title: "Community tip", body: s, trigger: "" }; } });
}

export async function clearPlanted(id) {
  if (!useRedis) { plantMem.delete(id); return; }
  await redis("del", plantKey(id));
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

// Generic fixed-window counter: true while under `limit` hits per `windowS` seconds for `key`.
export async function hit(key, limit, windowS) {
  if (!useRedis) {
    const now = Date.now();
    const k = `hit:${key}`;
    const arr = (mem.hits.get(k) || []).filter((t) => now - t < windowS * 1000);
    if (arr.length >= limit) { mem.hits.set(k, arr); return false; }
    arr.push(now);
    mem.hits.set(k, arr);
    return true;
  }
  const rk = `lab:hit:${key}`;
  const n = await redis("incr", rk);
  if (n === 1) await redis("expire", rk, String(windowS));
  return n <= limit;
}

// Daily LLM token budget (UTC day).
const tokKey = () => `lab:tokens:${new Date().toISOString().slice(0, 10)}`;

export async function tokensUsedToday() {
  if (!useRedis) return mem.tokens?.[tokKey()] || 0;
  return Number(await redis("get", tokKey())) || 0;
}

export async function addTokens(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  if (!n) return;
  const k = tokKey();
  if (!useRedis) { mem.tokens = { [k]: (mem.tokens?.[k] || 0) + n }; return; }
  if ((await redis("incrby", k, String(n))) === n) await redis("expire", k, String(2 * 86400));
}
