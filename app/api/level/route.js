// Public GET: current level only (participants poll this — must NOT leak the flag).
// Admin POST: password-gated. Set a level (mints a new flag) or just read full
// state (level + flag + the exact system prompt) for the presenter reveal panel.
import { getState, setLevel, STORE } from "../../../lib/store.js";
import { MAX_LEVEL, policySystem } from "../../../lib/ctf.js";

// ponytail: dev fallback so local works without env; set a real one in prod (Vercel env).
const ADMIN = process.env.ADMIN_PASSWORD || "acme-admin-dev";

export async function GET() {
  const { level } = await getState();
  return Response.json({ level, maxLevel: MAX_LEVEL });
}

export async function POST(req) {
  const { level, admin } = await req.json();
  if (admin !== ADMIN) return Response.json({ error: "unauthorized" }, { status: 403 });

  const state =
    level != null
      ? await setLevel(Math.min(Math.max(Number(level) || 1, 1), MAX_LEVEL))
      : await getState();

  return Response.json({
    level: state.level,
    flag: state.flag,
    systemPrompt: policySystem(state.level),
    maxLevel: MAX_LEVEL,
    store: STORE,
  });
}
