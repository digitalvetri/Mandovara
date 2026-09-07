"use server";

// Deleting a project.
//
// Its own file rather than an addition to actions.ts, which is already at
// the §10 300-line boundary — the same reason actions-flow.ts exists.
//
// A project is the spine the whole system hangs off, so this is the most
// dangerous delete in the app and it is deliberately narrow. Two rules
// shape it:
//
//   1. Anything that is money or stock BLOCKS the delete. An invoice,
//      receipt, payment, advance, order, purchase order, stock move,
//      make job or architect commission means the job really happened —
//      erasing the project would strand a ledger row pointing at an id
//      nobody can look up. Those cases get a sentence naming the
//      blocker and a nudge towards Cancel (archiveProject), which is
//      what a real project that went wrong should become.
//
//   2. Only planning-stage children are removed: rooms, measurements,
//      site visits, milestones, site logs, members, documents, tasks,
//      unbilled quotations, and pending project expenses. This is the
//      "typed the wrong client / duplicate row" case the delete exists
//      for.
//
// Fourteen tables carry a projectId with NO foreign key declared (Task,
// Attendance, Document, ChatChannel, CommunicationLog,
// WhatsAppConversation, and the money tables above). Postgres will
// neither block nor cascade on those, so a delete that ignored them
// would look like it succeeded while leaving rows pointing at a dead
// id. The money ones are in the blocker list; the rest are detached
// (projectId → null) rather than deleted, because an attendance punch
// or a WhatsApp thread belongs to the employee or the client, not to
// the project it happened to be tagged with.
//
// The AuditLog row is written by hand. scoped(ctx) composes the audit
// extension, but withTransaction() hands back a raw Prisma client the
// extension chain never sees — so a delete run inside one would vanish
// without a trace. Same pattern as quotations/actions-delete.ts.

import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";
import { describeBlockers, type DeleteBlocker } from "./delete-shared";
import { deleteProjectChildren } from "./delete-cascade";

/** Everything that makes a project real rather than mistyped. Read-only —
 *  the detail page calls this to decide what the confirm dialog says, and
 *  deleteProject() calls it again server-side so a stale page cannot slip
 *  a delete past the check. */
export async function getProjectDeleteBlockers(
  projectId: string,
): Promise<DeleteBlocker[]> {
  const ctx = await devContext();
  requirePermission(ctx, "project.delete");
  const db = scoped(ctx);

  const [
    invoices, receipts, payments, advances, orders,
    purchaseOrders, purchaseRequests, stockMoves, makeJobs,
    commissions, approvedExpenses,
  ] = await Promise.all([
    db.invoice.count({ where: { projectId } }),
    db.receipt.count({ where: { projectId } }),
    db.payment.count({ where: { projectId } }),
    db.advance.count({ where: { projectId } }),
    db.order.count({ where: { projectId } }),
    db.purchaseOrder.count({ where: { projectId } }),
    db.purchaseRequest.count({ where: { projectId } }),
    db.stockMove.count({ where: { projectId } }),
    db.makeJob.count({ where: { projectId } }),
    db.architectCommission.count({ where: { projectId } }),
    db.projectExpense.count({ where: { projectId, approvalState: "APPROVED" } }),
  ]);

  const blockers: DeleteBlocker[] = [];
  const add = (label: string, count: number) => {
    if (count > 0) blockers.push({ label, count });
  };

  add("invoice", invoices);
  add("receipt", receipts);
  add("payment", payments);
  add("advance", advances);
  add("order", orders);
  add("purchase order", purchaseOrders);
  add("purchase request", purchaseRequests);
  add("stock movement", stockMoves);
  add("production job", makeJobs);
  add("architect commission", commissions);
  add("approved expense", approvedExpenses);

  return blockers;
}

export async function deleteProject(
  projectId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.delete");

  if (typeof projectId !== "string" || projectId.length === 0) {
    return { ok: false, error: "Project not found" };
  }

  const db = scoped(ctx);
  const p = await db.project.findUnique({
    where:  { id: projectId },
    select: {
      id: true, number: true, name: true, stage: true,
      clientId: true, branchId: true, orderValue: true,
    },
  });
  if (!p) return { ok: false, error: "Project not found" };

  const blockers = await getProjectDeleteBlockers(projectId);
  if (blockers.length > 0) {
    return { ok: false, error: describeBlockers(blockers) };
  }

  // An accepted quotation is the client saying yes — same line
  // deleteQuotation() draws. No order exists yet (orders block above),
  // but the agreement is still evidence.
  const acceptedQuotes = await db.quotation.count({
    where: { projectId, status: "ACCEPTED" },
  });
  if (acceptedQuotes > 0) {
    return {
      ok: false,
      error:
        "This project has an accepted quotation — the client has already agreed to it. Cancel the project instead.",
    };
  }

  try {
    await withTransaction(async (tx: TxClient) => {
      // Children first — the ordering lives in delete-cascade.ts so a
      // database-backed test can run the real thing.
      await deleteProjectChildren(tx, projectId);

      await tx.project.delete({ where: { id: projectId } });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.orgId,
          actorId:        ctx.userId,
          entityType:     "Project",
          entityId:       projectId,
          action:         "DELETE",
          before: {
            number:     p.number,
            name:       p.name,
            stage:      p.stage,
            clientId:   p.clientId,
            branchId:   p.branchId,
            orderValue: p.orderValue.toString(),
          },
        },
      });
    }, { orgId: ctx.orgId });
  } catch (e) {
    console.error("[projects] deleteProject failed:", e);
    return {
      ok: false,
      error: "Could not delete the project — something else still refers to it.",
    };
  }

  revalidatePath("/projects");
  // The detail page too: DangerDeleteButton navigates away, but anyone
  // else holding the URL would otherwise be served the cached project.
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/clients");
  revalidatePath("/accounts");
  return { ok: true, data: { id: projectId } };
}
