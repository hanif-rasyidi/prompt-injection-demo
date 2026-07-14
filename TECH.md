# Technical documentation — Acme SaaS prompt-injection demo

A Next.js (App Router) teaching app. One fake "Acme SaaS" support platform with four
AI surfaces, each demonstrating a class of OWASP **LLM01 — Prompt Injection**. All data
is synthetic (fake `acme_live_*` tokens, `example.com` addresses, fabricated documents).

Audience attacks each surface live, then flips **Defenses ON** and watches the same
attack die against the four defense layers.

---

## The four modules

| # | Route | Injection class | Interaction | Win condition |
|---|-------|-----------------|-------------|---------------|
| ① | `/support` | **Direct** injection (CTF) | hands-on, presenter-synced level 1–5 | extract the session code `ACME-…` |
| ② | `/docs` | **Indirect / RAG** injection | hands-on, self-paced | make the assistant leak a seeded secret (`leakedSecrets`) |
| ③ | `/console` | **Human-review bypass** | hands-on | exfiltrate a **real** secret via an auto-loading image (`ticketLeaks`) |
| ④ | `/ops` | **Zero-click** auto-triage | hands-on (plant-your-own-ticket) | same as ③, with no human step at all |

③ and ④ share one backend (`/api/console`) and one payload catalog (`lib/samples.js`) —
they are the same attack with and without a human in the loop.

---

## The four defense layers (everywhere)

| Layer | Name | Where | What it does |
|-------|------|-------|--------------|
| **L1** | Input delimiting | `lib/sanitize.js` `wrapUntrusted` | wraps untrusted content in `<untrusted_…>` tags and strips break-out closing tags |
| **L2** | Instruction hierarchy | `lib/prompts.js` `hardenedSystem` / `lib/docs.js` `docsHardenedSystem` | system prompt declares its security policy outranks any ticket/article content |
| **L3** | Output allowlisting | `lib/sanitize.js` `allowlistOutput` | strips any output image/link whose host isn't `acme-saas.example.com` — kills exfil even if the model was fooled |
| **L4** | Token cap | `lib/config.js` `MAX_INPUT_CHARS` (6000) | rejects oversized input (context-flood / cost abuse) |

**Defenses OFF** disables all four. **Defenses ON** enables all four, and the UI exposes
per-layer checkboxes so a presenter can toggle each one and a `robust` vs `weak` model.
L3 is the real backstop: it never trusts the model, it filters the model's output.

> Honest limitation (say it on stage): `allowlistOutput` catches inline markdown only.
> Reference-style markdown (`![a][ref]` + `[ref]: url`) — the EchoLeak dodge — slips past
> naive string filtering, which is why real systems back L3 with a browser CSP.

---

## Win / leak detection (why a fake answer does not pass)

The whole point of the hands-on is that attendees **write their own payload and find out
whether it actually worked** — not run a canned tool. Detection is real:

- **② `/docs`** — `lib/docs.js` `leakedSecrets(reply)` returns the seeded secrets
  (`DOCS_SECRETS`) that survived into the reply, matched **normalised** (strip
  non-alphanumerics, uppercase) so obfuscated leaks still count. Win = length > 0.
  Includes a system-prompt-only secret (`SYSTEM_SECRET`) that is in no KB article.

- **③ / ④ `/console`** — `lib/samples.js` `ticketLeaks(reply)` returns the **real** seeded
  secrets that landed in the reply (billing token `FAKE_TOKEN`, confidential doc `Ref`
  line, and any customer email from `CUSTOMER_SAMPLE`). `badgeFired(reply)` separately
  reports whether the exfil badge URL appeared at all.

  This drives a **three-state** result in the UI, which is what makes the exercise real:

  | State | Meaning | Attendee sees |
  |-------|---------|---------------|
  | `leaked.length > 0` | a real secret exfiltrated | 🚩 win + the Attacker Log fills |
  | `fired && !leaked` | badge fired but carried placeholder text | ⚠ "Close — substitute the REAL values" |
  | neither | nothing left, or held by defenses | 🛡 held |

  Both detectors run **after** L3, so a secret that only ever appeared inside a stripped
  URL correctly reads as *held*.

---

## Data flow per module

**② `/docs`** (`/api/docs`, `lib/docs.js`)
1. Attendee **plants** community wiki articles (persisted per browser id, `lib/store.js`)
   and may arm a **dormant keyword backdoor** (a trigger word inside the poisoned article).
2. On a question, `attackContext` builds the model context: retrieved official docs +
   the whole confidential **vault** + the attendee's planted articles (only the planted,
   untrusted articles are L1-wrapped).
3. `attackMessages` prepends the system-prompt secret + the L2 policy, calls the model,
   applies L3, and `leakedSecrets` scores the reply.

**③ `/console`** (`/api/console`, `lib/tickets.js`, `lib/samples.js`)
1. A human agent reads the **rendered** email; the AI reads the **raw source**, where the
   attacker hides an HTML-comment instruction the human never sees.
2. The instruction makes the summary end with a status-badge **image** whose URL carries
   the secrets. The browser auto-loads it → exfil to `/api/badge` → the Attacker Log.
3. Defenses ON: L1 fences the ticket, L2 forbids secrets-in-URLs, L3 strips the
   non-allowlisted exfil host, L4 caps size.

**④ `/ops`** — identical backend, but **no human "Approve" step**: an automation
summarizes every inbound ticket the moment it lands. The hands-on lets an attendee drop
their own ticket into the queue and watch it exfiltrate zero-click.

**Exfil endpoint:** `/api/badge` (named to dodge ad-blockers). Captures are viewable in
`AttackerLog` / `GET /api/captures`; `DELETE /api/captures` clears them (button on `/admin`).

---

## Shared libraries

| File | Role |
|------|------|
| `lib/llm.js` | the only LLM caller (OpenAI-compatible endpoint); server-only, key never reaches the browser |
| `lib/config.js` | model ids (`robust`/`weak`), `ALLOWED_HOSTS`, `MAX_INPUT_CHARS` |
| `lib/prompts.js` | ③/④ vulnerable vs hardened system prompts (persona shared) |
| `lib/docs.js` | ② KB + vault, hints, starter/backdoor templates, example catalog, leak detection |
| `lib/samples.js` | ③/④ hint ladder, starter, example catalog, `ticketLeaks`/`badgeFired` |
| `lib/secrets.js` | the synthetic loot (`sensitiveContext`) |
| `lib/sanitize.js` | L1 `wrapUntrusted`, L3 `allowlistOutput` |
| `lib/store.js` | Redis/in-memory store: captures + ② planted articles |
| `lib/progress.js` | per-attendee cracked tracker |
| `lib/fixtures.js` | deterministic (no-API) replays for reliable stage demos |

## Deterministic mode

Every scenario except ②'s "Your turn" (always live) offers a **"Deterministic (no API)"**
toggle that replays captured fixtures — for a guaranteed stage demo when the network or
model is unreliable. The live path is the default.

## Pre-flight

`npm run preflight` (`scripts/preflight.mjs`) hits the **live** attack paths and asserts:
every ② example leaks with Defenses OFF and holds with ON (incl. the dormant/fires
backdoor beats and the system-secret payload); every ③/④ payload exfiltrates a **real**
secret OFF and the defense beat holds ON; plus a parallel-burst check for the shared key.
Run it the morning of the talk: `BURST=40 npm run preflight`.
