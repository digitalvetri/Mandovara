"use server";

// Server actions used by the "To Pay" tab rows.
//
// - markExpensePaid: sets Expense.paidAt = now. Removes the row from
//   the To Pay tab and stops it counting toward the TO PAY KPI.
//
// PurchaseOrder "mark paid" is intentionally NOT here yet — the PO
// schema tracks receipt-of-goods (SENT → PARTIAL → RECEIVED), not
// payment-of-money. A proper vendor-payment workflow needs a schema
// addition and is flagged in docs/HANDOVER-CHECKLIST.md.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { orgPrisma } from "@/kernel/db/rls";
import { devContext } from "@/lib/dev-context";
import { requirePermission } from "@/kernel/rbac/guard";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

const markPaidSchema = z.object({
  expenseId: z.string().min(1),
});

export async function markExpensePaid(input: unknown): Promise<ActionResult<null>> {
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  try {
    const ctx = await devContext();
    requirePermission(ctx, "expense.approve");   // same permission that approves the expense

    // Only mark an APPROVED expense as paid — refuse to shortcut past approval.
    const expense = await orgPrisma(ctx.orgId).expense.findUnique({
      where:  { id: parsed.data.expenseId },
      select: { id: true, approvalState: true, paidAt: true, organizationId: true },
    });
    if (!expense || expense.organizationId !== ctx.orgId) {
      return { ok: false, error: "Expense not found" };
    }
    if (expense.approvalState !== "APPROVED") {
      return { ok: false, error: "Only approved expenses can be marked paid" };
    }
    if (expense.paidAt) {
      return { ok: false, error: "Already marked paid" };
    }

    await orgPrisma(ctx.orgId).expense.update({
      where: { id: expense.id },
      data:  { paidAt: new Date() },
    });
    revalidatePath("/accounts");
    return { ok: true, data: null };
  } catch (e) {
    console.error("[accounts] markExpensePaid failed:", e);
    return { ok: false, error: "Could not mark as paid. Please try again." };
  }
}
