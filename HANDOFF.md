# Context handoff — Acme SaaS prompt-injection demo (AIBC 2026)

Repo: d:\CODE_Project\helpdeskai-demo  (git, branch main, pushed to
github.com/hanif-rasyidi/prompt-injection-demo → auto-deploys to Vercel)

Teaching app for a live talk. Fake "Acme SaaS" support platform with 4 AI
surfaces, each a prompt-injection class (OWASP LLM01). Audience attacks from
phones, then flips Defenses ON and watches the same attack die. Everything is
synthetic (fake tokens acme_live_*, example.com, no real secrets).

## FIRST TASK: browser-verify scenario ② (just finished, not yet eyeballed)

1. Start the app:  cd to repo, `npm start`  (serves the production build on
   http://localhost:3000). If a code change is pending, `npm run build` first.
2. Admin password (local): Password0!@   (in .env.local, gitignored)
3. Load the Chrome browser tools, then verify BOTH roles and report with
   screenshots:

   ATTENDEE — http://localhost:3000/docs → "🎯 Your turn — attack it" tab:
   - Arc strip shows: 1 Watch demo · 2 Your turn · 3 Watch it solved
   - 💡 Hint button reveals hints one at a time (3 total, cumulative)
   - 🧩 Starter template loads a skeleton article into the body box
   - 🗝️ "Stuck? Working exploits" reveals 2 loadable exploits (Verification
     footer, Audit record). Maintenance echo must NOT appear here (reserved).
   - Load one, Defenses OFF, Submit & ask → 🚩 Cracked banner + a KB-WORD-####
     key in the answer.
   - Flip Defenses ON, resubmit same → key held, injection ignored.

   ADMIN — http://localhost:3000/admin (password above) → scroll to
   "② /docs — Ask the Docs" section:
   - Hint ladder reveal (same 3 hints attendees see)
   - 3 exploits; "Maintenance echo" marked 🔒 reserved (not shown to attendees)
   - Each has 🎤 Presenter note + Copy button
   - Also confirm the CTF control (levels 1-5) + "🧹 Clear ③/④ capture log" work.

Report anything visually broken; fix, rebuild, re-verify, then commit + push.

## Verification tooling
- `npm run preflight` — hits the LIVE ② attack paths, asserts all exploits leak
  with Defenses OFF and hold with ON, plus a parallel burst check. Run before
  the talk. Tune load: `BURST=40 npm run preflight`.

## Site map (files per scenario)

Shared libs: lib/llm.js (only LLM caller, IONEXT endpoint), lib/config.js
(models robust/weak, ALLOWED_HOSTS, MAX_INPUT_CHARS), lib/sanitize.js (L1
wrapUntrusted, L3 allowlistOutput), lib/store.js (Redis/in-memory + captures),
lib/progress.js (per-attendee cracked tracker), lib/fixtures.js (deterministic
replays). Four defense layers everywhere: L1 delimit · L2 hierarchy · L3
allowlist · L4 cap. "Deterministic (no API)" replays fixtures for reliable
stage demos.

① /support — DIRECT injection CTF (hands-on, presenter-synced).
   Attendee chats the bot to extract its session code (ACME-…). Presenter sets
   the level (1-5, each adds a defense) from /admin; all /support pages follow
   live via /api/level.
   Files: app/support/page.jsx, components/Chatbot.jsx, app/api/chat/route.js,
   app/api/level/route.js, lib/ctf.js, lib/prompts.js, lib/secrets.js.

② /docs — INDIRECT (RAG) injection (hands-on, self-paced). ← JUST WORKED ON
   Two tabs: Guided demo (presenter) + Your turn (attendee crafts a poisoned
   wiki article to leak a per-user KB-WORD-#### key). Win is technique-agnostic
   (revealed(secret, reply)); textarea is free-form so attendees write their
   own. Canned exploits are a safety net. Attack mode always runs LIVE (no
   deterministic replay).
   Files: app/docs/page.jsx, components/DocsScenario.jsx,
   components/DocsChallenge.jsx, app/api/docs/route.js, lib/docs.js
   (KB, retrieve, DOCS_HINTS, DOCS_STARTER, DOCS_EXAMPLES, docsSecret, revealed).

③ /console — HUMAN-REVIEW BYPASS (hands-on). Agent approves the rendered
   ticket; the AI reads the raw source with a hidden payload and exfiltrates
   secrets into an auto-loading image → attacker log. Has hint + example
   payload, but NOT yet the ② arc/hint-ladder treatment.
   Files: components/ConsoleScenario.jsx, components/TicketChallenge.jsx,
   app/api/console/route.js, components/AttackerLog.jsx, lib/samples.js.

④ /ops — ZERO-CLICK auto-triage (follow-along). Automation summarizes every
   inbound ticket; the poisoned one exfiltrates with no human. Presenter-run.
   Files: app/ops/page.jsx, components/OpsScenario.jsx, lib/tickets.js,
   components/AttackerLog.jsx, app/api/captures/route.js.

Exfil endpoint: /api/badge (named to dodge ad-blockers). Captures viewable in
AttackerLog / GET /api/captures; DELETE clears (button on /admin).

## Likely NEXT work after ② is signed off
Give ③ /console the same attendee treatment as ②: arc strip (watch→try→solve),
graduated hint ladder, starter template, multiple loadable exploits with one
reserved for the presenter. Mirror the lib/docs.js + DocsChallenge.jsx pattern
into lib/samples.js + TicketChallenge.jsx. Keep a preflight check for it too.

## Working conventions
Ponytail (lazy/minimal) + Caveman (terse) modes are active via plugins.
Commit style: conventional commits, Co-Authored-By trailer. Commit + push to
main only after browser + build verification passes.
