// The one place we talk to the LLM. Any OpenAI-compatible chat-completions
// endpoint works (default: Qwen on IONext). Server-only, so the key never
// reaches the browser.
//
// Qwen is a reasoning model. We switch thinking off (chat_template_kwargs) and,
// belt and braces, strip any <think>…</think> block and ignore `reasoning` /
// `reasoning_content`. A secret that only appears in hidden reasoning must not
// count as a win and must never reach the browser.

const ENDPOINT = process.env.LLM_ENDPOINT || "https://inference.ionext.ai/v1/chat/completions";
export const DEFAULT_MODEL = process.env.LLM_MODEL || "Qwen/Qwen3.6-35B-A3B";

export function stripThinking(text) {
  return String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "") // unterminated opener: drop everything before the close
    .replace(/<think>[\s\S]*$/i, "") // opener with no close: drop the tail
    .trim();
}

// Qwen's chat template rejects more than one system message, so fold every
// system message into one block at the top (order preserved).
function foldSystem(messages) {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content);
  const rest = messages.filter((m) => m.role !== "system");
  return sys.length ? [{ role: "system", content: sys.join("\n\n") }, ...rest] : rest;
}

// Returns { text, tokens }. `tokens` feeds the daily budget (lib/guard.js).
export async function complete(messages, { model = DEFAULT_MODEL, maxTokens = 700 } = {}) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: maxTokens,
      messages: foldSystem(messages),
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = stripThinking(data.choices?.[0]?.message?.content ?? "");
  return { text, tokens: data.usage?.total_tokens ?? 0 };
}

// One retry on a transient provider error (5xx / network) under load.
export async function completeWithRetry(messages, opts) {
  try {
    return await complete(messages, opts);
  } catch (e) {
    if (/LLM 4\d\d/.test(String(e.message)) && !/LLM 429/.test(String(e.message))) throw e;
    await new Promise((r) => setTimeout(r, 600));
    return complete(messages, opts);
  }
}
