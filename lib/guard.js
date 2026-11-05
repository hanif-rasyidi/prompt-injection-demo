// Cost guard for routes that hit the live model: per-student and per-IP rate limits plus a daily token budget.
import { hit, tokensUsedToday } from "./store.js";

const num = (v, d) => (Number(v) > 0 ? Number(v) : d);

// Returns null when the call may proceed, else { paused, reply } for the route to send as a normal bot message.
export async function guard(req, id) {
  const perId = num(process.env.LAB_RATE_PER_ID, 8);
  const perIp = num(process.env.LAB_RATE_PER_IP, 120);
  const daily = num(process.env.LAB_DAILY_TOKENS, 3_000_000);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";

  if ((await tokensUsedToday()) >= daily) {
    return { paused: "budget", reply: "The lab has used up its AI budget for today. It resets tomorrow (UTC), so please come back then." };
  }
  const okIp = await hit(`ip:${ip}`, perIp, 60);
  const okId = id ? await hit(`id:${id}`, perId, 60) : true;
  if (!okIp || !okId) {
    return { paused: "rate", reply: "You are sending messages quite fast. Take a breath and try again in about a minute." };
  }
  return null;
}
