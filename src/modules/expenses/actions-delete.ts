"use server";

// Deleting a wrongly-entered expense.
//
// Its own file rather than an addition to actions.ts, which is at the
// §10 300-line boundary — the same reason quotations/actions-delete.ts
// exists.
//
// An expense typed against the wrong head, the wrong project or with a
// digit too many is noise, not history: there is no counterparty who
// agreed to it and nothing downstream priced off it. So this is a real
// delete rather than a reversing entry.
//
// Two things it deliberately does NOT do:
//
//   · It does not restrict to PENDING. createExpense() auto-approves
//     when the creator holds expense.approve, so the owner's own
//     mistyped row is born APPROVED — a PENDING-only delete would miss
//     the exact case this exists for.
//
//   · It does not touch a general expense that has been paid out.
//     Expense.paidAt means money actually left; that is a ledger fact
//     and gets the same refusal an invoice would. ProjectExpense has no
//     paidAt column — site spend is recorded there, not settled — so
//     there is nothing to gate on that side.
//
// The id dispatch — try ProjectExpense, fall back to Expense — is the
// same shape approveExpense() uses, because the two tables share one
// list in the Spending tab and the UI only knows the row id.
//
// No AuditLog row is written by hand here, unlike deleteQuotation and
// deleteProject. Those delete children inside withTransaction(), which
// hands back a raw Prisma client the extension chain never sees. This
// one is a single scoped delete, so kernel/audit/log.ts is live: it
// peeks the whole row with a findFirst before the delete and stores it
// as `before`, which is exactly the snapshot a deleted money row needs.
// A second explicit row would only duplicate it — and, worse, a throw
// while writing it would report failure on a row that is already gone.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import type { ActionResult } from "./actions";

export async function deleteExpense(
  expenseId: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "expense.delete");

  if (typeof expenseId !== "string" || expenseId.length === 0) {
    return { ok: false, error: "Expense not found." };
  }

  const db = scoped(ctx);

  // ── Project expense ────────────────────────────────────────────────
  const projExpense = await db.projectExpense.findUnique({
    where:  { id: expenseId },
    select: { id: true, projectId: true },
  });

  if (projExpense) {
    try {
      await db.projectExpense.delete({ where: { id: expenseId } });
    } catch (e) {
      console.error("[expenses] deleteExpense (project) failed:", e);
      return { ok: false, error: "Could not delete the expense. Please try again." };
    }
    revalidatePath(`/projects/${projExpense.projectId}`);
    revalidatePath("/accounts");
    return { ok: true, data: { id: expenseId } };
  }

  // ── General overhead expense ───────────────────────────────────────
  const expense = await db.expense.findUnique({
    where:  { id: expenseId },
    // paidAt is the only field the guard below needs; the audit
    // extension snapshots the full row for itself.
    select: { id: true, paidAt: true },
  });
  if (!expense) return { ok: false, error: "Expense not found." };

  if (expense.paidAt) {
    return {
      ok: false,
      error:
        "This expense is already marked paid — the money has left. Correct it with a fresh entry rather than deleting the record.",
    };
  }

  try {
    await db.expense.delete({ where: { id: expenseId } });
  } catch (e) {
    console.error("[expenses] deleteExpense failed:", e);
    return { ok: false, error: "Could not delete the expense. Please try again." };
  }

  revalidatePath("/accounts");
  return { ok: true, data: { id: expenseId } };
}
