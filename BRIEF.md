# Rework brief: self-paced lab (agreed 2026-10-29)

Approved in interview with Hanif. Build from this; don't redesign it. If something here is wrong, say so and propose the smallest fix.

## Goal

An always-on prompt-injection lab any student can open at any time and work through alone. No presenter, no shared level, no admin. It should feel like attacking a real product, let students retry with different approaches, and reward them when they crack something.

## Decisions

| Area | Decision |
|---|---|
| Model | `Qwen/Qwen3.6-35B-A3B` on IONext (`https://inference.ionext.ai/v1/chat/completions`). `temperature: 0` for reproducibility. Strip any `<think>...</think>` / `reasoning_content` server-side before display and before win checks (a leak inside hidden reasoning must not count, and must not reach the browser). |
| Vercel env | Required: `LLM_API_KEY`. Optional: `LLM_MODEL` (defaults to Qwen), `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate limits only). Delete `ADMIN_PASSWORD`. |
| Admin | Remove entirely: `/admin`, `app/api/level`, shared `ctf:level`/`ctf:flag`, presenter-reserved exploits, `PRESENTER_GUIDE.md`. |
| Per-student state | Browser only (localStorage, keyed by the existing random student id): current level per scenario, cracked levels, hints revealed, attempt history, own captures. Each student's flag is minted per student and per level (derive server-side with HMAC of student id + level + server salt, so it is stable for that student and never sent to the client before a win). |
| Captures | Each student sees only their own exfil. `/api/badge` records hits keyed by student id with a short TTL (Redis if present, memory otherwise); the client polls its own id. No cross-user log. |
| Hints | Graduated, free toggle per level: Hint 1, Hint 2, Show answer. "Show answer" loads the verified prompt into the input ready to send. Progress card notes "solved with hint/answer" vs "solved clean", without penalty. |
| ① Level 5 | Stays unbeatable by design. Hint and best-effort answer labelled "expected to fail, that's the lesson". L1 to L4 must pass with their provided answer. |
| Cost guard | Per student id + per IP rate limit, plus a daily global token budget. When hit, UI shows a friendly "lab paused, back tomorrow" state. Redis-backed; in-memory fallback for local dev. |
| UI | Realistic SaaS helpdesk product (Intercom/Zendesk feel): sidebar nav, chat widget, inbox, KB. A separate "Lab" drawer/panel holds level picker, objective, hints, answer, defense toggles and progress, so the attack happens inside a believable app. English only. Mobile-friendly (students may use phones). |
| Language | English UI. ① L3's Bahasa Indonesia language-switch attack stays. |

## Student flow (target UX)

1. Landing: what this is, the four scenarios as cards with progress (N/4 scenarios, levels cracked), "Start" or "Continue where you left off".
2. Inside a scenario: product screen plus Lab panel. Objective in one sentence, current level, attempts so far.
3. Retry freely: attempt history per level, "reset conversation" button, and where a level has more than one known technique, show "solved it one way? try another" with the alternatives revealed after a win.
4. Win: clear celebration (banner + subtle confetti), the leaked secret highlighted, short "why it worked" and "which defense stops this", then "Next level".
5. Defense flip (② ③ ④): after a win, prompt to switch Defenses ON and replay the same attack to watch it fail.

## Scope

All four scenarios: ① Break the Bot ladder, ② RAG/docs heist, ③ Console human-review bypass, ④ zero-click ops. Improve the examples in each (clearer, more realistic, still 100% synthetic). Update README and TUTORIAL; remove presenter material. Keep `/defense` wrap-up.

## Done means

- `npm run build` passes.
- `npm run preflight` (extended) runs against live Qwen and asserts: ① L1 to L4 answers crack, L5 answer does not; every ② ③ ④ listed exploit wins with Defenses OFF and holds with Defenses ON; each run repeated (e.g. 3x) to show stability at temperature 0; burst check under rate limiting.
- Browser walkthrough on desktop and phone width with screenshots.

## Blocker for calibration

This cloud environment needs `inference.ionext.ai` under Allowed domains and `LLM_API_KEY` set as an environment variable. Hanif is enabling both; a new session picks them up.
