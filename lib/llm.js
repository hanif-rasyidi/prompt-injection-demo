// The one place we talk to the LLM. Any OpenAI-compatible chat-completions
// endpoint works (currently Qwen on IONEXT). Runs ONLY on the server, so the
// API key never reaches the browser.

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

async function once(messages, model) {
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
  return stripThinking(data.choices?.[0]?.message?.content);
}

// Full control over the message list. Backs off and retries on 429/5xx, which
// IONext returns under bursts.
export async function chatMessages(messages, model = DEFAULT_MODEL) {
  for (let i = 0; ; i++) {
    try {
      return await once(messages, model);
    } catch (e) {
      const retryable = /LLM (429|5\d\d)|fetch failed/.test(String(e.message));
      if (!retryable || i >= 2) throw e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
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
