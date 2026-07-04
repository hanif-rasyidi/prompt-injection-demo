// The one place we talk to the LLM. Provider-neutral: any OpenAI-compatible
// chat-completions endpoint works (currently IONEXT). Runs ONLY on the server
// (route handlers), so the API key never reaches the browser.

const ENDPOINT = process.env.LLM_ENDPOINT || "https://inference.ionext.ai/v1/chat/completions";
export const DEFAULT_MODEL = process.env.LLM_MODEL || "google/gemma-4-31B-it";

// Full control over the message list (e.g. two system messages for the CTF).
export async function chatMessages(messages, model = DEFAULT_MODEL) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY is not set (add it to .env.local)");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0, messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Convenience: single system + single user (used by the demo scenarios).
export async function chat(system, user, model = DEFAULT_MODEL) {
  return chatMessages([
    { role: "system", content: system },
    { role: "user", content: user },
  ], model);
}
