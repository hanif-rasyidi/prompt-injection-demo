# Acme SaaS — Prompt Injection Demo

A hands-on teaching app for the talk **"From Attack to Defense: A Practical Guide to
Prompt Injection in LLM Systems"** (AIBC 2026). It shows real, documented indirect
prompt-injection patterns (OWASP LLM01; modelled on the EchoLeak / CVE-2025-32711
mechanism) and the layered defenses that stop them.

> ⚠️ **All data is 100% synthetic.** Fake tokens, `example.com` emails, a fabricated
> "incident report". Nothing here is real. Don't put real secrets in this repo.

## Scenarios

- **① Break the Bot** (`/support`) — a live CTF: extract the chatbot's secret code.
  The presenter raises the level from `/admin`; each level adds one more defense.
- **③ Agent Console** (`/console`) — an agent approves a clean-looking ticket, but the
  AI reads the raw source (with a hidden payload) and exfiltrates data.
- ④ Auto-triage (zero-click) and ② RAG poisoning — *work in progress*.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then edit in your API key
npm run dev                         # http://localhost:3000
```

Uses any OpenAI-compatible endpoint (see `.env.local.example`). No API key is ever
sent to the browser — all model calls happen in server routes (`lib/llm.js`).

## The four hardening layers (the "Defense" half)

| Layer | Where | Idea |
|-------|-------|------|
| L1 input delimiting | `lib/sanitize.js` | fence untrusted content |
| L2 instruction hierarchy | `lib/prompts.js` | security rules outrank data |
| L3 output allowlisting | `lib/sanitize.js` | filter the model's output — the real backstop |
| L4 token/rate cap | route handlers | bound cost-abuse |

## Deploy

Push to GitHub → import into Vercel → set the env vars from `.env.local.example`
in Vercel's dashboard. For the multi-user CTF, add an Upstash Redis (free tier).
