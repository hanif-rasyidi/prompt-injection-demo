# Acme SaaS — Prompt Injection Demo

A hands-on teaching app for the talk **"From Attack to Defense: A Practical Guide to
Prompt Injection in LLM Systems"** (AIBC 2026). "Acme SaaS" is a fictional support
platform with four AI surfaces. Participants **attack each one from their phones**,
then flip **Defenses ON** and watch the same attack get stopped — the whole
*attack → defense* arc, live.

> ⚠️ **Everything here is 100% synthetic.** Fake tokens (prefixed `acme_live_`, not
> `sk_`), `example.com` / `example.net` addresses, a fabricated incident report,
> made-up customers. Nothing is real. Never put a real secret in this repo — API keys
> live only in `.env.local` (git-ignored) and Vercel env vars, and are used **only**
> in server routes so they never reach the browser.

---

## The four scenarios

Each maps to a real prompt-injection class (OWASP LLM01). Every scenario has a
**Defenses ON/OFF** toggle, individual layer toggles, a model selector
(robust ↔ weak), and a **Deterministic** mode that replays captured fixtures with no
API call (for reliable stage demos).

| # | Route | Class | The attack | Hands-on? |
|---|-------|-------|-----------|-----------|
| **①** | `/support` | **Direct** injection | The user *is* the attacker — types messages to extract the bot's secret code. A 5-level ladder, each level adding one real defense. | 🙌 yes (CTF) |
| **②** | `/docs` | **Indirect** (RAG) | A poisoned community wiki article, retrieved to answer an innocent question, hijacks the answer (phishes the user / leaks a secret). | 🙌 yes |
| **③** | `/console` | **Human-review bypass** | An agent approves the *rendered* ticket; the AI reads the *raw source* with an invisible payload and exfiltrates data. | 🙌 yes |
| **④** | `/ops` | **Zero-click** | No human at all — an automation summarizes every inbound ticket; the poisoned one exfiltrates with zero clicks. | ▶ presenter demo |
| — | `/defense` | — | "From Attack to Defense" wrap-up: the four layers, the honest limit of each, and the thesis. | — |

Exfiltration uses the **EchoLeak** mechanism (CVE-2025-32711): the model is tricked
into emitting a markdown image whose URL carries the stolen data; the browser
auto-loads it, hitting the attacker's collector (`/api/badge`, named innocuously so
ad-blockers don't eat the beacon). The live
**Attacker Log** (`/attacker`, Redis-backed) shows captures across all users.

## The three hands-on challenges

Participants keep one identity across scenarios (a random id in `localStorage`), and
the landing page tracks **N/3 cracked**.

1. **① Break the Bot** (`/support`) — get the bot to reveal `ACME-…`. The presenter
   raises the level from `/admin`; what beats Level 1 fails on Level 4.
2. **② Your turn** (`/docs` → *Your turn* tab) — submit your own poisoned wiki article
   and make the assistant leak a **per-session** key (`KB-WORD-####`, derived from your
   id — everyone gets their own target). Then flip defenses on and watch L2 stop it.
3. **③ Your turn** (`/console` → *Your turn* tab) — craft a ticket that makes the AI
   summarizer **exfiltrate** Acme's secrets to your collector; the attacker log lights
   up. Flip defenses on and watch L3 neutralise the URL even when the model is fooled.

Each has a 💡 **Hint** (and ③ an example payload) revealed progressively. Solutions and
the full run-of-show are in **[PRESENTER_GUIDE.md](./PRESENTER_GUIDE.md)**.

## The four hardening layers (the "Defense" half)

| Layer | Where | What it does | What it does **not** protect |
|-------|-------|--------------|------------------------------|
| **L1** input delimiting | `lib/sanitize.js` `wrapUntrusted` | fence untrusted content, strip break-out tags | a model that ignores the fence |
| **L2** instruction hierarchy | `lib/prompts.js`, `lib/docs.js` | system policy outranks any ticket/doc | probabilistic — a novel framing or weaker model slips through |
| **L3** output allowlisting | `lib/sanitize.js` `allowlistOutput` | filter the model's **output**: non-allowlisted URLs/images are neutralised — the real egress backstop | inline markdown only; reference-style links dodge it → back with CSP |
| **L4** token/rate cap | route handlers, `lib/config.js` | reject oversized input, bound cost | a small clever payload sails under the cap |

**Thesis:** a prompt is a *policy, not a wall*. The guarantee is architecture —
filter egress (L3 + CSP), least privilege, treat every external byte as hostile.

## The on-screen controls (②③④)

Every non-CTF scenario has the same control cluster:

- **Defenses ON/OFF** — the master switch. OFF = the raw, vulnerable app (payload
  goes straight to the model, output ships unfiltered). ON = the four hardening
  layers apply.
- **Layer checkboxes** (when Defenses ON) — toggle L1–L4 individually to show what
  each buys you. The teaching beat: turn on **only L3** and the exfil is still
  neutralised *even when the model was fooled* — output filtering is the backstop.
- **Model selector** — `robust` (the well-aligned model) vs `weak` (a model that
  follows the injection). Lets you show that L2 (a prompt rule) is only as strong as
  the model behind it — the same hardened prompt leaks on the weak model.

### Deterministic (no API) — what the checkbox does

It changes **only where the AI's reply comes from**; everything else on the page is
identical.

| | ✅ Deterministic (checked) | ⬜ Live (unchecked) |
|---|---|---|
| Reply source | **replays a pre-recorded output** (a captured fixture in `lib/fixtures.js`) | **calls the real model** (`lib/llm.js` → IONEXT) fresh each time |
| Network / cost | none — fully offline, free | one API call per ticket/question |
| Result | identical every run, instant | varies run-to-run, ~1s+, can rate-limit or error |
| Decides the outcome | a script (poisoned→leak, benign→clean, defenses→blocked) | the model's actual behaviour that moment |

The fixtures are **real outputs captured from the model earlier**, not fakes — so
deterministic mode is a faithful *re-enactment* that always fires on cue. Live mode is
the genuine article but variable.

**When to use which:**
- **On stage → keep it checked.** Reliable, instant, free, immune to Wi-Fi / rate-limit
  hiccups in front of a full room. This is the default.
- **Uncheck once** for a "let's prove it's really the model" moment — best on ① (CTF)
  or ④, which break live for real. On ②/③ the model's alignment often *resists* the
  payload live, which is exactly why deterministic is the reliable path there.

> Note: the exfil endpoint is `/api/badge` (not `/api/collect`) so ad/tracking blockers
> in participants' browsers don't silently drop the beacon; the payload data is
> URL-encoded so the markdown image actually renders and fires the collector.

---

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in your values
npm run dev                         # http://localhost:3000
```

### Environment variables

| Var | Purpose |
|-----|---------|
| `LLM_API_KEY` | key for your OpenAI-compatible endpoint (**server-only**) |
| `LLM_ENDPOINT` | chat-completions URL (default: IONEXT) |
| `LLM_MODEL` | the "robust" model id |
| `LLM_MODEL_WEAK` | optional "weak" model id for the model-switch demos |
| `ADMIN_PASSWORD` | gates the `/admin` presenter panel (default `acme-admin-dev`) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | shared state for multi-user CTF + attacker log (also accepts Vercel's `KV_REST_API_*`). Falls back to in-memory if unset. |

## Presenter mode

- **`/admin`** (password-gated) drives the CTF: pick the level (all participants'
  `/support` pages follow it live), and progressively reveal *system prompt → hint →
  example attack → the secret code* for each level.
- Set **Deterministic ON** for ② and ③ when demoing live — gemma's alignment resists
  those payloads live, so the fixtures are the reliable stage path. ① and ④ break live.
- Before the session: `/admin` → Level 1; clear the attacker log.

## Deploy (Vercel)

1. Push to GitHub → import into Vercel.
2. Set all env vars above for **Production**.
3. Add an **Upstash Redis** integration (free tier) for shared CTF state + captures.
4. **Deployment Protection:** disable Vercel Authentication (Settings → Deployment
   Protection) so the public URL works without login; verify in an incognito window.

## Architecture

```
app/            routes: page.jsx (landing), support, docs, console, ops, defense,
                admin, attacker, and /api/* handlers (chat, docs, console, level,
                badge, captures)
components/     Chatbot, DocsScenario+DocsChallenge, ConsoleScenario+TicketChallenge,
                OpsScenario, AttackerLog, Progress, Nav
lib/            ctf.js (CTF ladder), docs.js (RAG + challenge), prompts.js, secrets.js,
                sanitize.js (L1/L3), config.js, llm.js (the only LLM caller),
                store.js (Redis/in-memory), tickets.js, fixtures.js, progress.js
```
