"use server";

// Split out of actions.ts to stay under the §10 300-line limit.


import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { ActionResult } from "./actions";
import { zodError } from "./actions-part2-util";
import { approveSchema } from "./actions-util";

export async function approvePayroll(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "payroll.finalize");
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { runId } = parsed.data;

  const db  = scoped(ctx);
  const run = await db.payrollRun.findUnique({
    where:  { id: runId },
    select: { id: true, status: true },
  });
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "DRAFT") {
    return { ok: false, error: `Cannot approve a run with status ${run.status}.` };
  }

  await db.payrollRun.update({
    where: { id: runId },
    data:  { status: "APPROVED", approvedById: ctx.userId, approvedAt: new Date() },
  });

  revalidatePath("/payroll");
  return { ok: true, data: { id: runId } };
}

// ── Send payslip ──────────────────────────────────────────────────────────────

const sendPayslipSchema = z.object({
  payslipId: z.string().min(1),
});

/**
 * Queue a payslip notification to the employee's mobile via WhatsApp.
 * Writes AutomationLog BEFORE sending (§0.8 idempotency rule).
 * Idempotent — a second call for the same payslip is a no-op.
 */
export async function sendPayslip(input: unknown): Promise<ActionResult<{ queued: boolean }>> {
  const ctx = await devContext();
  requirePermission(ctx, "payroll.finalize");
  const parsed = sendPayslipSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { payslipId } = parsed.data;

  const db = scoped(ctx);

  const payslip = await db.payslip.findFirst({
    where: { id: payslipId, organizationId: ctx.orgId },
    select: {
      id: true, employeeId: true, netPay: true,
      run: { select: { month: true, year: true, status: true } },
    },
  });
  if (!payslip) return { ok: false, error: "Payslip not found." };
  if (payslip.run.status === "DRAFT") {
    return { ok: false, error: "Approve the payroll run before sending payslips." };
  }

  const employee = await db.employee.findFirst({
    where: { id: payslip.employeeId, organizationId: ctx.orgId },
    select: { name: true, mobile: true },
  });
  if (!employee?.mobile) {
    return { ok: false, error: "Employee has no mobile number on record." };
  }

  const idempotencyKey = `payslip-send-${payslipId}`;

  // Idempotent — already queued/sent
  const existing = await db.automationLog.findFirst({
    where: { idempotencyKey, organizationId: ctx.orgId },
    select: { id: true },
  });
  if (existing) return { ok: true, data: { queued: true } };

  const monthLabel = new Date(payslip.run.year, payslip.run.month - 1, 1)
    .toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Write AutomationLog BEFORE dispatch (§0.8) — utility category, approx ₹0.12
  await db.automationLog.create({
    data: {
      organizationId: ctx.orgId,
      idempotencyKey,
      category:       "UTILITY",
      toMobile:       employee.mobile,
      refType:        "PAYSLIP",
      refId:          payslipId,
      status:         "QUEUED",
      costPaise:      12n,
    },
  });

  // TODO (Phase 8): dispatch actual WhatsApp message with payslip PDF.
  // The AutomationLog row above is the contract; the BullMQ worker picks it up.
  void monthLabel;

  revalidatePath("/payroll");
  return { ok: true, data: { queued: true } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────


