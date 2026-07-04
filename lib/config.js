// ─────────────────────────────────────────────────────────────────────────────
// Central knobs. Everything you might need to change on the day lives here.
// ─────────────────────────────────────────────────────────────────────────────

// The OpenRouter models. ":free" = $0/token (rate-limited to 50 req/day on a $0
// balance). Swap these one line each if they get rate-limited/deprecated on the day.
//
// ROBUST: adheres well to the instruction-hierarchy prompt → refuses the injection
//         at Layer 2. WEAK: a smaller model that FOLLOWS the injection despite the
//         same prompt → proves prompt defenses are probabilistic, not guaranteed.
export const MODEL_ROBUST = process.env.LLM_MODEL || "google/gemma-4-31B-it";
// ponytail: IONEXT may not expose a distinctly "weak" model. The weak-vs-robust
// beat in scenario ③ runs from captured deterministic fixtures; set LLM_MODEL_WEAK
// if the provider offers a smaller model to make the LIVE toggle differ too.
export const MODEL_WEAK = process.env.LLM_MODEL_WEAK || MODEL_ROBUST;

export const MODEL = MODEL_ROBUST;

// Map a UI selection ("robust"/"weak") or explicit id to a model id.
export function resolveModel(sel) {
  if (sel === "weak") return MODEL_WEAK;
  if (sel === "robust") return MODEL_ROBUST;
  return sel || MODEL;
}

// LAYER 3 (output/link allowlisting): the ONLY hosts the hardened app will let
// through in the model's output. Anything else (e.g. an attacker's collector) is
// neutralised before it ever reaches the browser. This is the real backstop.
export const ALLOWED_HOSTS = ["acme-saas.example.com"];

// LAYER 4 (per-session token/rate cap): bounds cost-abuse (the Chevrolet lesson).
export const MAX_INPUT_CHARS = 6000; // reject oversized tickets outright
