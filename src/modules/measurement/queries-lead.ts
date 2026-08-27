// Lead-scoped measurement read-side (2026-08-27).
//
// Mirrors queries-client.ts, but for a prospect who has not become a
// client yet. Everything a lead's measurement panel needs to show
// "what have we actually measured on this site" before anyone has
// committed to anything.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface LeadRoundRow {
  id:        string;
  number:    string;
  revision:  number;
  visitedAt: Date;
  status:    string;
  itemCount: number;
  roomCount: number;
}

export async function listRoundsForLead(
  ctx:    RequestContext,
  leadId: string,
): Promise<LeadRoundRow[]> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);

  const rounds = await db.measurement.findMany({
    where:   { leadId },
    orderBy: [{ visitedAt: "desc" }, { revision: "desc" }],
    select: {
      id: true, number: true, revision: true, visitedAt: true, status: true,
      items: { select: { id: true, roomId: true } },
    },
  });

  return rounds.map((r) => ({
    id:        r.id,
    number:    r.number,
    revision:  r.revision,
    visitedAt: r.visitedAt,
    status:    r.status,
    itemCount: r.items.length,
    roomCount: new Set(r.items.map((i) => i.roomId)).size,
  }));
}

/**
 * Does this lead have an APPROVED, non-superseded round?
 *
 * This is the gate for offering a FIRM quotation on a lead. Without a
 * measurement the only honest thing to send is a rough estimate — which
 * is the two-quote model the lead page has followed since 25 Aug 2026,
 * now decided by the data rather than by whether a client record exists.
 */
export async function leadHasApprovedMeasurement(
  ctx:    RequestContext,
  leadId: string,
): Promise<boolean> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);

  const rounds = await db.measurement.findMany({
    where:  { leadId, status: "APPROVED" },
    select: { id: true, supersedesId: true },
  });
  if (rounds.length === 0) return false;

  // A round is "head" if nothing supersedes it — the same rule
  // listItemsForFirmQuote applies.
  const superseded = new Set(
    rounds.map((r) => r.supersedesId).filter((v): v is string => typeof v === "string"),
  );
  return rounds.some((r) => !superseded.has(r.id));
}
