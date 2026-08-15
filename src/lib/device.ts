// Server-side device detection from the User-Agent header.
//
// Used by the project-detail "Start measurement" flow to decide which
// route to redirect to (docs/BUILD-SPEC.md project-detail §4):
//   - phone / tablet → /m/measure/[projectId] (the field PWA)
//   - desktop        → /projects/[id]/measurements/[id] (office detail)
//
// Runs on the server because `pointer: coarse` and viewport queries
// can't be evaluated before the redirect fires. Read the UA from
// next/headers at the point of decision — never pass it around as a
// prop, and never trust anything the client sends beyond the UA
// itself (which is already at the request boundary).

import { headers } from "next/headers";

/** True when the requester looks like a phone or tablet. */
export async function isMobileUserAgent(): Promise<boolean> {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  return matchesMobile(ua);
}

// Testable pure helper. Deliberately conservative — false negatives
// (misdetected desktop) just send the user to the office surface,
// where they can still fall back to the "Open on phone" QR action.
export function matchesMobile(ua: string): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua);
}
