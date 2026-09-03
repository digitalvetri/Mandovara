"use server";

// Deleting a quotation.
//
// Its own file rather than an addition to actions.ts, which is already
// at the §10 300-line boundary — the same reason actions-part2.ts and
// actions-status.ts exist.
//
// A quotation is a document, not a ledger entry, so a genuine delete
// (rather than a soft "cancelled" flag) is the right shape: a quote
// typed against the wrong client is noise nobody wants to keep reading
// past. What it must NOT do is delete a quotation that something
// downstream is standing on — an order was raised from it, or a later
// revision points back at it. Those refuse with a sentence saying which
// document is in the way, in the shape deleteClient() established.
//
// The audit row is written by hand here. scoped(ctx) composes the audit
// extension, but withTransaction() hands back a raw Prisma transaction
// client that the extension chain never sees — so a delete run inside
// one would vanish without a trace. The lines have to be removed in the
// same transaction as their parent, so the transaction is not optional;
// the explicit AuditLog row is what pays for it. Same pattern as
// architects/actions.ts.

import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

/** Statuses a quotation may be deleted in. ACCEPTED is excluded even
 *  when no Order row exists yet: the client has said yes to it, so it
 *  is evidence of an agreement rather than a discarded draft. */
const DELETABLE = new Set(["DRAFT", "REVISED", "SENT", "REJECTED", "EXPIRED", "PENDING_APPROVAL", "APPROVED"]);

export async function deleteQuotation(
  quotationId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "quotation.delete");

  if (typeof quotationId !== "string" || quotationId.length === 0) {
    return { ok: false, error: "Quotation not found" };
  }

  const db = scoped(ctx);
  const q = await db.quotation.findUnique({
    where:  { id: quotationId },
    select: {
      id: true, number: true, revision: true, status: true,
      total: true, clientId: true, leadId: true, projectId: true,
    },
  });
  if (!q) return { ok: false, error: "Quotation not found" };

  if (!DELETABLE.has(q.status)) {
    return {
      ok: false,
      error: "An accepted quotation can't be deleted — the client has already agreed to it.",
    };
  }

  // An order raised from this quote is a live commitment; deleting the
  // document it was priced from would leave the order quoting a number
  // nobody can look up.
  const orderCount = await db.order.count({ where: { quotationId } });
  if (orderCount > 0) {
    return {
      ok: false,
      error: `Can't delete — an order was raised from ${q.number}. Cancel the order first.`,
    };
  }

  // A revision chain: this quote is the parent of a later one.
  const revisionCount = await db.quotation.count({ where: { parentId: quotationId } });
  if (revisionCount > 0) {
    return {
      ok: false,
      error: `Can't delete — ${q.number} was revised, and the newer revision points back at it.`,
    };
  }

  // QuotationLine has no onDelete: Cascade on its quotation relation, so
  // the children have to go first or Postgres rejects the parent delete.
  try {
    await withTransaction(async (tx: TxClient) => {
      await tx.quotationLine.deleteMany({ where: { quotationId } });
      await tx.quotation.delete({ where: { id: quotationId } });
      await tx.auditLog.create({
        data: {
          organizationId: ctx.orgId,
          actorId:        ctx.userId,
          entityType:     "Quotation",
          entityId:       quotationId,
          action:         "DELETE",
          before: {
            number:    q.number,
            revision:  q.revision,
            status:    q.status,
            total:     q.total.toString(),
            clientId:  q.clientId,
            leadId:    q.leadId,
            projectId: q.projectId,
          },
        },
      });
    }, { orgId: ctx.orgId });
  } catch (e) {
    console.error("[quotations] deleteQuotation failed:", e);
    return {
      ok: false,
      error: "Could not delete the quotation — something else still refers to it.",
    };
  }

  revalidatePath("/quotations");
  revalidatePath("/projects");
  return { ok: true, data: { id: quotationId } };
}
