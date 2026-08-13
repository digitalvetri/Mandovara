// §5.5 Conflict review — /m/measure/conflicts
//
// Server-wins is the default (§7). This page surfaces the *loser*
// (the local payload the server rejected) so the measurer can either
// discard it, or promote it with a reason that lands in the audit
// log. Nothing here silently goes away.
//
// Conflicts live in IndexedDB — this page is a thin shell around the
// ConflictReview client component that reads them.

import { ConflictReview } from "./_components/ConflictReview";

export const dynamic = "force-dynamic";

export const viewport = {
  themeColor: "#0F2A28",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function ConflictsPage() {
  return <ConflictReview />;
}
