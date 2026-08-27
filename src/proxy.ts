import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Paths that never need authentication (change-password itself is gated
// server-side against a valid session — putting it here just means the
// middleware doesn't force a redirect; the page still checks the cookie).
// /sw.js and /offline MUST be public. A service worker script served behind a
// redirect is rejected outright by the browser ("The script resource is behind
// a redirect, which is disallowed"), so gating it broke registration for any
// signed-out visitor — and with no service worker there is no install prompt.
// The worker itself caches nothing sensitive; see public/sw.js.
const PUBLIC_PATHS = [
  // /forgot-password must be public for the obvious reason: someone who
  // cannot sign in is exactly who needs it. Omitting it meant the login
  // page's "Forgot password?" link redirected straight back to login —
  // a loop, at the one moment a user is already stuck (fixed 2026-08-28).
  "/login", "/forgot-password", "/change-password", "/api/health", "/sw.js", "/offline",
];
// Path prefixes always allowed (webhooks use their own HMAC; /api/admin/
// endpoints use a token header; the rest are static assets).
const PUBLIC_PREFIXES = [
  "/api/webhooks/",
  "/api/admin/",
  "/_next/",
  "/favicon.ico",
  "/icons/",
  "/images/",
  "/fonts/",
  "/catalog/uploads/",
  "/mandovara-mark.png",
  "/mandovara-logo.jpg",
  "/manifest.webmanifest",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifySession(cookie);
  if (!userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    const res = NextResponse.redirect(url);
    // If a cookie was present but invalid (bad sig, rotated secret), clear it.
    if (cookie) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
