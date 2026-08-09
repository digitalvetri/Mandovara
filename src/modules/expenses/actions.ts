"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { createProjectExpenseSchema, approveExpenseSchema } from "./schema";

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

export async function approveExpense(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "expense.approve");

  const parsed = approveExpenseSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, state } = parsed.data;

  const db      = scoped(ctx);
  const expense = await db.projectExpense.findUnique({
    where: { id },
    select: { id: true, approvalState: true, projectId: true },
  });
  if (!expense) return { ok: false, error: "Expense not found." };
  if (expense.approvalState !== "PENDING") {
    return { ok: false, error: `Expense is already ${expense.approvalState}.` };
  }

  await db.projectExpense.update({
    where: { id },
    data: { approvalState: state, approvedById: ctx.userId },
  });

  revalidatePath(`/projects/${expense.projectId}`);
  revalidatePath("/expenses");
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
