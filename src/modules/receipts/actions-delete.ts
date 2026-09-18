"use server";

// Delete a payment that was entered by mistake — wrong client, wrong
// amount, entered twice.
//
// Owner instruction, 2026-09-18: "for the admin I need to give an option
// of deleting this wrongly entered payment". Gated on its own key,
// receipt.delete, which no seeded role carries: the Owner has it through
// isOwnerRole, and it can be granted to anyone else from Admin & Roles.
// Deliberately not receipt.reverse — that key is Accounts' everyday
// cheque-bounce control, and deleting money from the books is a bigger
// thing than marking a cheque as returned.
//
// Unwinds the payment the way bounceReceipt does — lock the invoices it
// was on, remove its allocations, put each invoice's status back — then
// removes the Receipt row itself and leaves an AuditLog entry carrying
// what was deleted, so the gap in the receipt numbers can be explained.
//
// What it does not undo: a project the advance gate already moved on
// because of this payment stays where it is. The gate only ever moves
// forward; stage is changed by hand from the project if it needs to go
// back.

import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { recomputeInvoiceStatuses } from "./invoice-status";
import { deleteReceiptSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function deleteReceipt(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.delete");

  const parsed = deleteReceiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Validation failed" };
  const { id } = parsed.data;

  const db  = scoped(ctx);
  const row = await db.receipt.findUnique({
    where: { id },
    select: {
      id: true, number: true, clientId: true, projectId: true, date: true,
      mode: true, reference: true, amount: true, chequeStatus: true,
      allocations: { select: { invoiceId: true, amount: true } },
    },
  });
  if (!row) return { ok: false, error: "Payment not found — it may already have been deleted." };

  const invoiceIds = [...new Set(row.allocations.map((a) => a.invoiceId))];

  await withTransaction(async (tx: TxClient) => {
    if (invoiceIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM "Invoice"
        WHERE id = ANY(${invoiceIds}::text[])
        FOR UPDATE
      `;
    }

    // ReceiptAllocation has no cascade — clear it first or the delete
    // fails on the foreign key.
    await tx.receiptAllocation.deleteMany({ where: { receiptId: id } });
    await tx.receipt.delete({ where: { id } });
    await recomputeInvoiceStatuses(tx, invoiceIds);

    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "Receipt",
        entityId:       id,
        action:         "DELETE",
        before: {
          number:       row.number,
          clientId:     row.clientId,
          projectId:    row.projectId,
          date:         row.date.toISOString(),
          mode:         row.mode,
          reference:    row.reference,
          amount:       row.amount.toString(),
          chequeStatus: row.chequeStatus,
          allocations:  row.allocations.map((a) => ({
            invoiceId: a.invoiceId, amount: a.amount.toString(),
          })),
        },
      },
    });
  }, { orgId: ctx.orgId });

  revalidatePath("/accounts");
  revalidatePath("/invoicing");
  revalidatePath("/projects");
  revalidatePath(`/clients/${row.clientId}`);
  if (row.projectId) revalidatePath(`/projects/${row.projectId}`);
  for (const invId of invoiceIds) revalidatePath(`/invoicing/${invId}`);
  return { ok: true, data: { id } };
}
