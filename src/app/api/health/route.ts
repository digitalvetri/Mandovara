// Deploy health probe — always 200, no DB / no auth / no redirect.
// Coolify's default health check pings `/` and expects 200; the app
// redirects `/ → /login` with 307, which Coolify counts as unhealthy
// and rolls the deploy back. Point the Coolify health check at
// `/api/health` instead so it exercises a real "is the server up"
// signal without fighting the auth layer.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return Response.json({ ok: true });
}
