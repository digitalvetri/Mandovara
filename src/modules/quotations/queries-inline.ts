// Inline quotation lists for embedding in a client or lead detail page.
// Split out of queries-part2 (2026-08-27) when the lead page's Send action
// needed validUntil + shareToken on each row and pushed that file past the
// 300-line ceiling. Re-exported through queries.ts, so callers are
// unaffected.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface QuotationInlineRow {
  id:          string;
  number:      string;
  revision:    number;
  date:        Date;
  status:      string;
  total:       bigint;
  lineCount:   number;
  // null for lead-scoped quotations (no project until conversion)
  projectId:   string | null;
  projectName: string | null;
  // Needed by the lead page's inline Send action, which renders the same
  // client-facing message as the quotation header (share-message.ts).
  validUntil:  Date;
  shareToken:  string | null;
  // Carried so the lead page can tell a LIVE token from an EXPIRED one.
  // Without it, a quote that still has a (dead) token looks minted and
  // the client receives a /q/<token> link that 404s.
  shareTokenExpiresAt: Date | null;
}

/** Small-table list for embedding in a client detail or lead detail
 *  page. Newest first, no pagination — a client with 200 quotes is
 *  rare enough to add a "See all" link at the bottom instead. */
export async function listQuotationsForClient(
  ctx:      RequestContext,
  clientId: string,
  limit = 20,
): Promise<QuotationInlineRow[]> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where:   { clientId },
    orderBy: [{ date: "desc" }, { revision: "desc" }],
    take:    limit,
    select: {
      id: true, number: true, revision: true, date: true,
      status: true, total: true, validUntil: true,
      shareToken: true, shareTokenExpiresAt: true,
      project: { select: { id: true, name: true } },
      _count:  { select: { lines: true } },
    },
  });
  // Filter out lead-scoped (no project) — this helper is called with a
  // clientId, and lead-scoped quotes shouldn't appear here anyway (they
  // have leadId set, clientId null, so wouldn't match the where clause).
  // Defensive filter in case of legacy data.
  return rows
    .filter((r): r is typeof r & { project: { id: string; name: string } } => r.project !== null)
    .map((r) => ({
      id:          r.id,
      number:      r.number,
      revision:    r.revision,
      date:        r.date,
      status:      r.status,
      total:       r.total,
      lineCount:   r._count.lines,
      projectId:   r.project.id,
      projectName: r.project.name,
      validUntil:  r.validUntil,
      shareToken:  r.shareToken,
      shareTokenExpiresAt: r.shareTokenExpiresAt,
    }));
}

/** Lead-scoped quotations for the lead detail inline table. */
export async function listLeadScopedQuotations(
  ctx:    RequestContext,
  leadId: string,
): Promise<QuotationInlineRow[]> {
  requirePermission(ctx, "quotation.view");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where:   { leadId },
    orderBy: [{ date: "desc" }, { revision: "desc" }],
    take:    20,
    select: {
      id: true, number: true, revision: true, date: true, status: true, total: true,
      validUntil: true, shareToken: true, shareTokenExpiresAt: true,
      _count: { select: { lines: true } },
    },
  });
  return rows.map((r) => ({
    id:          r.id,
    number:      r.number,
    revision:    r.revision,
    date:        r.date,
    status:      r.status,
    total:       r.total,
    lineCount:   r._count.lines,
    projectId:   null,
    projectName: null,
    validUntil:  r.validUntil,
    shareToken:  r.shareToken,
    shareTokenExpiresAt: r.shareTokenExpiresAt,
  }));
}
