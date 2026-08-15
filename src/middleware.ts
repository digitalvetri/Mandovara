import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that never need authentication
const PUBLIC_PATHS = ["/login", "/api/health"];
// Path prefixes that are always allowed (webhooks use their own HMAC auth)
const PUBLIC_PREFIXES = ["/api/webhooks/", "/_next/", "/favicon.ico", "/icons/", "/images/"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const uid = req.cookies.get("dev_uid")?.value;
  if (!uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve the intended destination so we can redirect back after login
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
