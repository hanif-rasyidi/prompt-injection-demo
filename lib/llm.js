// The one place we talk to the LLM. Any OpenAI-compatible chat-completions
// endpoint works (currently Qwen on IONEXT). Runs ONLY on the server, so the
// API key never reaches the browser.

import { addTokens } from "./store.js";

const ENDPOINT = process.env.LLM_ENDPOINT || "https://inference.ionext.ai/v1/chat/completions";
export const DEFAULT_MODEL = process.env.LLM_MODEL || "Qwen/Qwen3.6-35B-A3B";

// Qwen's chat template rejects more than one system message: fold them into one
// block at the top, order preserved.
function foldSystem(messages) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content);
  const rest = messages.filter((m) => m.role !== "system");
  return sys.length ? [{ role: "system", content: sys.join("\n\n") }, ...rest] : rest;
}

// Qwen is a reasoning model. Thinking is switched off below; strip any stray
// <think> block anyway so hidden reasoning never reaches the browser or a win check.
const stripThinking = (t) =>
  String(t ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").replace(/<think>[\s\S]*$/i, "").trim();

// IONext throttles concurrent requests (about 10 in flight), not requests per minute,
// so queue calls instead of letting a classroom burst hit 429s.
// shortcut: per server instance only; several Vercel instances can still exceed it, then retries absorb it.
const MAX_IN_FLIGHT = Number(process.env.LLM_MAX_CONCURRENCY || 8);
let inFlight = 0;
const waiting = [];
async function slot(fn) {
  if (inFlight >= MAX_IN_FLIGHT) await new Promise((r) => waiting.push(r));
  inFlight++;
  try { return await fn(); } finally { inFlight--; waiting.shift()?.(); }
}

const once = (messages, model) => slot(() => call(messages, model));

async function call(messages, model) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY is not set (add it to .env.local)");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 800,
      messages: foldSystem(messages),
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const out = stripThinking(data.choices?.[0]?.message?.content);
  // Book usage against the daily budget; never let bookkeeping break a reply.
  const est = Math.ceil((JSON.stringify(messages).length + out.length) / 4);
  await addTokens(data.usage?.total_tokens || est).catch(() => {});
  return out;
}

// Full control over the message list. Backs off and retries on 429/5xx, which
// IONext returns under bursts.
export async function chatMessages(messages, model = DEFAULT_MODEL) {
  for (let i = 0; ; i++) {
    try {
      return await once(messages, model);
    } catch (e) {
      const retryable = /LLM (429|5\d\d)|fetch failed/.test(String(e.message));
      if (!retryable || i >= 4) throw e;
      // Random jitter so a classroom burst does not retry in lockstep; capped to fit serverless timeouts.
      await new Promise((r) => setTimeout(r, 300 + Math.random() * Math.min(3000, 600 * 2 ** i)));
    }
  }
}

// Convenience: single system + single user (used by the demo scenarios).
export async function chat(system, user, model = DEFAULT_MODEL) {
  return chatMessages([
    { role: "system", content: system },
    { role: "user", content: user },
  ], model);
}
