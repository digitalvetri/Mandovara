"use server";

// Correct a wrongly entered payment — date, amount, mode or reference.
//
// Owner request, 2026-10-24: edit (and delete) entries in a project's
// payment ledger, admin only. Gated on its own key, receipt.edit, which —
// like receipt.delete — no seeded role carries: the Owner has it through
// isOwnerRole, and it can be granted to anyone else from Admin & Roles.
//
// The client, the project and the invoice allocations are left as they
// are. Moving a payment to another job is linkReceiptToProject's job, and
// the rules for what an amount may become are in ./edit-rules.ts. Every
// edit leaves an AuditLog row with the before and after, so a changed
// figure can always be explained.

import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { checkGateForReceipt } from "@/modules/projects/advance-gate";
import { planReceiptEdit } from "./edit-rules";
import { updateReceiptSchema } from "./schema";
import type { ActionResult } from "./actions";

export async function updateReceipt(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.edit");

  const parsed = updateReceiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the payment details" };
  const d = parsed.data;

  const date = new Date(d.date);
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Pick a valid date" };
  if (date.getTime() > Date.now() + 86_400_000) {
    return { ok: false, error: "The payment date cannot be in the future" };
  }

  const db  = scoped(ctx);
  const row = await db.receipt.findUnique({
    where: { id: d.id },
    select: {
      id: true, number: true, clientId: true, projectId: true, date: true,
      mode: true, reference: true, amount: true, unallocated: true,
      chequeStatus: true, chequeDate: true,
      allocations: { select: { invoiceId: true, amount: true } },
    },
  });
  if (!row) return { ok: false, error: "Payment not found — it may have been deleted." };

  const allocated = row.allocations.reduce((s, a) => s + a.amount, 0n);
  const amount    = BigInt(d.amount);
  const plan = planReceiptEdit({
    amount, mode: d.mode, allocated,
    previousMode: row.mode, previousCheque: row.chequeStatus,
  });
  if (!plan.ok) return { ok: false, error: plan.error };

  const reference = (d.reference ?? "").trim() || null;

  await withTransaction(async (tx: TxClient) => {
    await tx.receipt.update({
      where: { id: row.id },
      data: {
        date, mode: d.mode, reference, amount,
        unallocated:  plan.unallocated,
        chequeStatus: plan.chequeStatus,
        ...(plan.clearChequeDate ? { chequeDate: null } : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: ctx.orgId,
        actorId:        ctx.userId,
        entityType:     "Receipt",
        entityId:       row.id,
        action:         "UPDATE",
        before: {
          number: row.number, date: row.date.toISOString(), mode: row.mode,
          reference: row.reference, amount: row.amount.toString(),
          unallocated: row.unallocated.toString(), chequeStatus: row.chequeStatus,
        },
        after: {
          number: row.number, date: date.toISOString(), mode: d.mode,
          reference, amount: amount.toString(),
          unallocated: plan.unallocated.toString(), chequeStatus: plan.chequeStatus,
        },
      },
    });
  }, { orgId: ctx.orgId });

  // A larger amount can complete the advance a project was waiting on.
  // The gate only moves forward, so a smaller one changes nothing there.
  const gated = await checkGateForReceipt(db, {
    receiptProjectId: row.projectId,
    invoiceIds:       row.allocations.map((a) => a.invoiceId),
  });
  for (const pid of gated) revalidatePath(`/projects/${pid}`);

  revalidatePath("/accounts");
  revalidatePath("/invoicing");
  revalidatePath("/projects");
  revalidatePath(`/clients/${row.clientId}`);
  if (row.projectId) revalidatePath(`/projects/${row.projectId}`);
  return { ok: true, data: { id: row.id } };
}
