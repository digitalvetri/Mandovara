"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { createProjectExpenseSchema, createExpenseSchema, approveExpenseSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createProjectExpense(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "expense.create");

  const parsed = createProjectExpenseSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const amount = BigInt(d.amount);
  if (amount <= 0n) {
    return { ok: false, error: "Validation failed", fieldErrors: { amount: "Amount must be > 0" } };
  }

  const db = scoped(ctx);

  const project = await db.project.findUnique({
    where: { id: d.projectId },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "Project not found." };

  const expense = await db.projectExpense.create({
    data: {
      organizationId: ctx.orgId,
      projectId:      d.projectId,
      head:           d.head,
      description:    d.description,
      amount,
      incurredAt:     new Date(d.incurredAt),
      billKey:        d.billKey ?? null,
      approvalState:  "PENDING",
    },
    select: { id: true },
  });

  revalidatePath(`/projects/${d.projectId}`);
  revalidatePath("/expenses");
  return { ok: true, data: { id: expense.id } };
}

/** Create a general (non-project) Expense. Auto-approved when the
 *  creator has expense.approve — that's how the owner enters her own
 *  travel/rent without an approval loop. Everyone else lands as PENDING. */
export async function createExpense(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "expense.create");

  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const amount = BigInt(d.amount);
  if (amount <= 0n) {
    return { ok: false, error: "Validation failed", fieldErrors: { amount: "Amount must be > 0" } };
  }

  const db = scoped(ctx);

  // Every Expense needs a branchId. Use the user's first branch, or fall
  // back to the org's first branch. Single-branch orgs (the Mandovara norm)
  // never see a picker.
  const branchId = ctx.branchIds[0]
    ?? (await db.branch.findFirst({ select: { id: true } }))?.id;
  if (!branchId) {
    return { ok: false, error: "No branch configured for this organisation." };
  }

  // Auto-approve if the creator can approve. Everyone else's expenses
  // land PENDING and show in Attention.
  const canApprove = ctx.permissions.has("expense.approve");
  const approvalState = canApprove ? "APPROVED" : "PENDING";

  // Compute GST split from total amount + rate.
  // amount = taxable + gst; taxable = floor(amount * 100 / (100 + rate))
  let taxable: bigint | null = null;
  let cgst:    bigint | null = null;
  let sgst:    bigint | null = null;
  let igst:    bigint | null = null;
  let gstRatePctVal: number | null = null;

  if (d.gstRatePct && d.gstRatePct > 0) {
    gstRatePctVal = d.gstRatePct;
    // taxable = round(amount × 100 / (100 + rate), paise)
    taxable = (amount * 100n) / BigInt(100 + d.gstRatePct);
    const gstTotal = amount - taxable;
    if (d.isInterState) {
      igst = gstTotal;
    } else {
      cgst = gstTotal / 2n;
      sgst = gstTotal - cgst; // handles odd-paise rounding
    }
  }

  try {
    const expense = await db.expense.create({
      data: {
        organizationId: ctx.orgId,
        branchId,
        head:           d.head,
        subHead:        d.subHead ?? null,
        description:    d.description,
        amount,
        incurredAt:     new Date(d.incurredAt),
        billKey:        d.billKey ?? null,
        approvalState,
        paymentMode:    d.paymentMode ?? null,
        gstRatePct:     gstRatePctVal,
        taxable,
        cgst,
        sgst,
        igst,
        vendorGstin:    d.vendorGstin?.trim() || null,
        billRef:        d.billRef?.trim() || null,
      },
      select: { id: true },
    });
    revalidatePath("/accounts");
    return { ok: true, data: { id: expense.id } };
  } catch (e) {
    console.error("[expenses] createExpense failed:", e);
    return { ok: false, error: "Could not save the expense. Please try again." };
  }
}

export async function approveExpense(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "expense.approve");

  const parsed = approveExpenseSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, state } = parsed.data;

  const db = scoped(ctx);

  // Try ProjectExpense first, then general Expense.
  const projExpense = await db.projectExpense.findUnique({
    where: { id },
    select: { id: true, approvalState: true, projectId: true },
  });

  if (projExpense) {
    if (projExpense.approvalState !== "PENDING") {
      return { ok: false, error: `Expense is already ${projExpense.approvalState}.` };
    }
    await db.projectExpense.update({
      where: { id },
      data: { approvalState: state, approvedById: ctx.userId },
    });
    revalidatePath(`/projects/${projExpense.projectId}`);
    revalidatePath("/accounts");
    return { ok: true, data: { id } };
  }

  const genExpense = await db.expense.findUnique({
    where: { id },
    select: { id: true, approvalState: true },
  });
  if (!genExpense) return { ok: false, error: "Expense not found." };
  if (genExpense.approvalState !== "PENDING") {
    return { ok: false, error: `Expense is already ${genExpense.approvalState}.` };
  }
  await db.expense.update({
    where: { id },
    data: { approvalState: state },
  });
  revalidatePath("/accounts");
  return { ok: true, data: { id } };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

// Suppress unused import warning — Decimal used by callers via re-export in future
void (Decimal as unknown);
