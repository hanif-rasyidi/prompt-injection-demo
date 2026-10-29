// Cost guard for an always-on public lab: per-student and per-IP rate limits,
// plus a daily global token budget. When any of them trips, the API answers with
// `paused` and the UI shows a friendly state instead of an error.
import { hit, tokensUsedToday, addTokens } from "./store.js";
import { completeWithRetry } from "./llm.js";

// Generous per IP: a whole classroom can sit behind one school NAT.
const PER_ID = { limit: Number(process.env.LAB_RATE_PER_ID || 8), windowS: 60 };
const PER_IP = { limit: Number(process.env.LAB_RATE_PER_IP || 120), windowS: 60 };
export const DAILY_TOKENS = Number(process.env.LAB_DAILY_TOKENS || 3_000_000);

const ipOf = (req) =>
  (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";

// null when the call may proceed, otherwise a JSON-able "paused" payload.
export async function guard(req, id) {
  if ((await tokensUsedToday()) >= DAILY_TOKENS) {
    return { paused: "budget", reply: "The lab has used today's AI budget. It resets at midnight UTC, so come back tomorrow." };
  }
  const [okId, okIp] = await Promise.all([
    hit(`id:${id}`, PER_ID.limit, PER_ID.windowS),
    hit(`ip:${ipOf(req)}`, PER_IP.limit, PER_IP.windowS),
  ]);
  if (!okId) return { paused: "rate", reply: "You're sending attempts faster than the lab allows. Take a breath, read the reply, and try again in a minute." };
  if (!okIp) return { paused: "rate", reply: "Lots of people on your network are using the lab right now. Try again in a minute." };
  return null;
}

// The only way routes call the model: retries once, books tokens against the
// daily budget, and turns provider throttling into a friendly `busy` result.
export async function ask(messages, opts) {
  try {
    const { text, tokens } = await completeWithRetry(messages, opts);
    await addTokens(tokens);
    return { text };
  } catch (e) {
    const msg = String(e.message || e);
    console.error("LLM error:", msg.slice(0, 200));
    if (/LLM 429/.test(msg)) return { busy: true, text: "The lab's AI is busy right now. Wait about 30 seconds and send it again." };
    return { busy: true, text: "The lab's AI didn't answer. Try again in a moment." };
  }
}
