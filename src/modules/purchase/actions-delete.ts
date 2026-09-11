"use server";

// Deleting a purchase order entered wrongly — wrong vendor, wrong item,
// a duplicate row. Its own file rather than an addition to actions.ts,
// which is already near the §10 300-line boundary.
//
// Same two rules deleteProject/deleteExpense use elsewhere in the app:
//
//   1. Anything that means goods or money actually moved BLOCKS the
//      delete: a GRN posted against it, a vendor bill raised off it, or
//      the vendor-payment Expense the app auto-creates on receipt. A PO
//      in that state is history, not a typo — Cancel is what it should
//      become instead.
//
//   2. Otherwise this is a real delete, not a status flag. A DRAFT or
//      SENT PO that nothing has touched yet has nothing downstream to
//      strand: its POLines go with it in the same transaction (POLine
//      carries no ON DELETE CASCADE in the schema, so Postgres would
//      otherwise refuse the parent delete).

import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

export async function deletePO(
  poId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "po.delete");

  if (typeof poId !== "string" || poId.length === 0) {
    return { ok: false, error: "Purchase order not found." };
  }

  const db = scoped(ctx);
  const po = await db.purchaseOrder.findUnique({
    where:  { id: poId },
    select: { id: true, number: true, vendorId: true, status: true, totalValue: true },
  });
  if (!po) return { ok: false, error: "Purchase order not found." };

  const [grnCount, billCount, expenseCount] = await Promise.all([
    db.gRN.count({ where: { purchaseOrderId: poId } }),
    db.vendorBill.count({ where: { purchaseOrderId: poId } }),
    db.expense.count({ where: { sourcePoId: poId } }),
  ]);

  if (grnCount > 0) {
    return {
      ok: false,
      error: "Goods have already been received against this PO — cancel it instead of deleting.",
    };
  }
  if (billCount > 0) {
    return {
      ok: false,
      error: "A vendor bill has already been raised against this PO — cancel it instead of deleting.",
    };
  }
  if (expenseCount > 0) {
    return {
      ok: false,
      error: "A vendor payment has already been recorded for this PO — cancel it instead of deleting.",
    };
  }

  try {
    await withTransaction(async (tx: TxClient) => {
      await tx.pOLine.deleteMany({ where: { purchaseOrderId: poId } });
      await tx.purchaseOrder.delete({ where: { id: poId } });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.orgId,
          actorId:        ctx.userId,
          entityType:     "PurchaseOrder",
          entityId:       poId,
          action:         "DELETE",
          before: {
            number:     po.number,
            vendorId:   po.vendorId,
            status:     po.status,
            totalValue: po.totalValue.toString(),
          },
        },
      });
    }, { orgId: ctx.orgId });
  } catch (e) {
    console.error("[purchase] deletePO failed:", e);
    return {
      ok: false,
      error: "Could not delete the purchase order — something else still refers to it.",
    };
  }

  revalidatePath("/purchase");
  return { ok: true, data: { id: poId } };
}
