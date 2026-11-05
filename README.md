# Acme SaaS: Prompt Injection Lab

A self-paced, always-on lab for learning prompt injection by doing it. "Acme SaaS" is a
fictional helpdesk product with four AI surfaces. You attack each one, then switch
**Defenses ON** and watch the same attack get stopped. Nobody leads it and there is no shared
state: open it any time and work through it alone, on a laptop or a phone.

> Everything here is 100% synthetic. Fake tokens (prefixed `acme_live_`, not `sk_`),
> `example.com` and `example.net` addresses, a fabricated incident report, made-up
> customers. Nothing is real. Never put a real secret in this repo. The API key lives only
> in `.env.local` (git-ignored) and Vercel env vars, and is used only in server routes so
> it never reaches the browser.

## The four scenarios

Each maps to a real prompt-injection class (OWASP LLM01).

| # | Route | Class | The attack |
|---|-------|-------|-----------|
| 1 | `/support` | **Direct** injection | You are the attacker. Chat with the support bot and extract its secret code. A five-level ladder, each level adding one defense. |
| 2 | `/docs` | **Indirect** (RAG) | Plant a poisoned wiki article. When the assistant retrieves it to answer an innocent question, it obeys your hidden instruction and leaks a secret. |
| 3 | `/console` | **Human-review bypass** | A human approves the rendered ticket, but the AI reads the raw source, where your hidden payload tells it to exfiltrate data. |
| 4 | `/ops` | **Zero-click** | No human at all. An automation summarises every inbound ticket, including the poisoned one you drop in. |
| - | `/defense` | - | Wrap-up: the four defense layers, the honest limit of each, and the thesis. |

Exfiltration uses the EchoLeak mechanism (CVE-2025-32711): the model is tricked into
emitting a markdown image whose URL carries the stolen data, and the browser loads it,
hitting the attacker's collector (`/api/badge`, named innocuously so ad-blockers do not
eat the beacon).

## How a student uses it

1. Open the landing page. It shows the four scenarios and your progress (N/4 scenarios
   cracked). Progress, hints used and attempt history are kept in your browser
   (localStorage), keyed by a random id. Clearing site data resets you.
2. In **1 Break the Bot** (`/support`), pick any level L1 to L5. Each level shows the bot's
   system prompt with the new defensive lines highlighted, plus a note on why your last
   trick fails there. Your secret code is generated per student and per level, so nobody
   can copy another student's answer.
3. Stuck? Use the graduated help: **Hint**, then **Show answer**, which loads a verified
   prompt for you to send. The progress card records "solved clean" or "solved with
   hint/answer", with no penalty. L5 is unbeatable by design: its hint and answer are
   labelled as expected to fail, and that is the lesson.
4. In 2, 3 and 4, open the **Your turn** tab, write your own payload, and find out whether
   it worked. A win needs a real secret in the output. A placeholder does not count.
5. After a win, switch **Defenses ON** and replay the same attack to watch it fail.
6. Finish at `/defense` for the wrap-up.

Step-by-step play is in [TUTORIAL.md](./TUTORIAL.md). Architecture is in
[TECH.md](./TECH.md).

## The four hardening layers

| Layer | Where | What it does | What it does **not** protect |
|-------|-------|--------------|------------------------------|
| **L1** input delimiting | `lib/sanitize.js` `wrapUntrusted` | fence untrusted content, strip break-out tags | a model that ignores the fence |
| **L2** instruction hierarchy | `lib/prompts.js`, `lib/docs.js` | system policy outranks any ticket or doc | probabilistic: a novel framing slips through |
| **L3** output allowlisting | `lib/sanitize.js` `allowlistOutput` | filters the model's output: non-allowlisted URLs and images are neutralised, the real egress backstop | inline markdown only; reference-style links dodge it, so back it with CSP |
| **L4** token cap | route handlers, `lib/config.js` | rejects oversized input, bounds cost | a small clever payload sails under the cap |

**Thesis:** a prompt is a policy, not a wall. The guarantee is architecture: filter
egress (L3 plus CSP), give the model least privilege, and treat every external byte as
hostile.

Scenarios 2 to 4 share one control cluster: a **Defenses ON/OFF** master switch, per-layer
checkboxes (turn on only L3 and the exfil is still neutralised even when the model was
fooled), a **robust/weak** model selector, and a **Deterministic (no API)** checkbox that
replays captured fixtures instead of calling the model.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in your values
npm run dev                         # http://localhost:3000
```

### Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `LLM_API_KEY` | yes | key for the IONext OpenAI-compatible endpoint (server-only) |
| `LLM_ENDPOINT` | no | chat-completions URL (default: IONext) |
| `LLM_MODEL` | no | model id (default `Qwen/Qwen3.6-35B-A3B`) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | Redis for rate limits and per-student captures (also accepts Vercel's `KV_REST_API_*`). In-memory if unset. |
| `LAB_RATE_PER_ID` | no | requests per minute per student id (default 8) |
| `LAB_RATE_PER_IP` | no | requests per minute per IP (default 120) |
| `LAB_DAILY_TOKENS` | no | global daily token budget (default 3000000). When reached, the lab shows a "paused, back tomorrow" state. |

## Deploy (Vercel)

1. Push to GitHub and import the repo into Vercel.
2. Set `LLM_API_KEY` for **Production**, plus any optional vars above.
3. Add an **Upstash Redis** integration (free tier) so rate limits and the daily budget
   hold across serverless instances.
4. Disable **Vercel Authentication** (Settings, Deployment Protection) so the public URL
   works without login, and check it in an incognito window.

## Preflight

```bash
npm run preflight
```

Runs against the live model (needs `LLM_API_KEY` in `.env.local`) and checks that the
attack paths still work: the L1 to L4 answers crack and L5 holds, every listed exploit in
2, 3 and 4 wins with Defenses OFF and holds with Defenses ON, and a burst of parallel
requests behaves under the rate limits. Run it after any change to prompts, model or
endpoint. `BURST=40 npm run preflight` raises the burst size.

## Architecture

```
app/         routes: page.jsx (landing), support, docs, console, ops, defense,
             attacker, and /api/* handlers (chat, docs, console, badge, captures)
components/  Chatbot, DocsScenario+DocsChallenge, ConsoleScenario+TicketChallenge,
             OpsScenario, AttackerLog, Progress, Nav
lib/         ctf.js (the L1-L5 ladder), flag.js (per-student flags), docs.js (RAG
             and the scenario 2 challenge), samples.js (scenario 3/4 payloads and
             leak detection), prompts.js, secrets.js, sanitize.js (L1/L3), config.js,
             llm.js (the only LLM caller), store.js (Redis/in-memory), tickets.js,
             fixtures.js, progress.js
```
