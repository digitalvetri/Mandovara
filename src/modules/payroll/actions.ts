"use server";

import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { computePayslip } from "@/kernel/payroll/compute";
import type { StatutorySlabInput } from "@/kernel/payroll/compute";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

// ── Set salary structure ──────────────────────────────────────────────────────

const setStructureSchema = z.object({
  employeeId:    z.string().min(1),
  basic:         z.string().trim().min(1, "Enter monthly basic (rupees)"),
  hra:           z.string().trim().min(1, "Enter monthly HRA (rupees)"),
  conveyance:    z.string().trim().default("0"),
  other:         z.string().trim().default("0"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

export async function setSalaryStructure(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "employee.viewSalary");
  const parsed = setStructureSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const employee = await db.employee.findUnique({
    where:  { id: d.employeeId },
    select: { id: true },
  });
  if (!employee) return { ok: false, error: "Employee not found." };

  const structure = {
    basic:         d.basic,
    hra:           d.hra,
    conveyance:    d.conveyance,
    other:         d.other,
    effectiveFrom: d.effectiveFrom,
  };

  await db.employee.update({
    where: { id: d.employeeId },
    data:  { salaryStructure: structure },
  });

  revalidatePath("/payroll");
  return { ok: true, data: { id: d.employeeId } };
}

// ── Run payroll ───────────────────────────────────────────────────────────────

const runPayrollSchema = z.object({
  month: z.number().int().min(1).max(12),
  year:  z.number().int().min(2020).max(2100),
});

/**
 * Create a PayrollRun for the given month-year and generate payslips for all
 * active employees who have a salary structure.
 *
 * Requires all attendance records for the month to be locked first.
 */
export async function runPayroll(
  input: unknown,
): Promise<ActionResult<{ runId: string; payslipCount: number }>> {
  const ctx = await devContext();
  requirePermission(ctx, "payroll.run");
  const parsed = runPayrollSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { month, year } = parsed.data;

  const db         = scoped(ctx);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 1));

  // ── Guard: no duplicate run ────────────────────────────────────────────────
  const existing = await db.payrollRun.findUnique({
    where: { organizationId_month_year: { organizationId: ctx.orgId, month, year } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: `Payroll for ${monthLabel(month, year)} has already been run (id: ${existing.id}).` };
  }

  // ── Guard: all attendance records for the month must be locked ─────────────
  const unlockedCount = await db.attendance.count({
    where: {
      organizationId: ctx.orgId,
      date:           { gte: monthStart, lt: monthEnd },
      lockedAt:       null,
    },
  });
  if (unlockedCount > 0) {
    return {
      ok:    false,
      error: `${unlockedCount} attendance record(s) are not locked. Run lockMonth first.`,
    };
  }

  // ── Fetch employees with salary structure ─────────────────────────────────
  const allEmployees = await db.employee.findMany({
    where:  { organizationId: ctx.orgId, status: "ACTIVE" },
    select: { id: true, salaryStructure: true },
  });
  const employees = allEmployees.filter((e) => e.salaryStructure != null);
  if (employees.length === 0) {
    return { ok: false, error: "No active employees have a salary structure configured." };
  }

  // ── Fetch active statutory slabs ──────────────────────────────────────────
  const now = new Date();
  const rawSlabs = await db.statutorySlab.findMany({
    where: {
      organizationId: ctx.orgId,
      effectiveFrom:  { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
    },
    select: { kind: true, fromAmount: true, toAmount: true, rate: true, flatAmount: true },
  });
  const slabs: StatutorySlabInput[] = rawSlabs.map((s) => ({
    kind:       s.kind,
    fromAmount: s.fromAmount,
    toAmount:   s.toAmount,
    rate:       s.rate ? new Decimal(s.rate.toString()) : null,
    flatAmount: s.flatAmount,
  }));

  // ── Fetch absence/half-day counts for the month ───────────────────────────
  const absentRows = await db.attendance.findMany({
    where: {
      organizationId: ctx.orgId,
      date:           { gte: monthStart, lt: monthEnd },
      status:         { in: ["ABSENT", "HALF_DAY"] },
    },
    select: { employeeId: true, status: true },
  });

  const absenceByEmp = new Map<string, { absentDays: number; halfDays: number }>();
  for (const row of absentRows) {
    const entry = absenceByEmp.get(row.employeeId) ?? { absentDays: 0, halfDays: 0 };
    if (row.status === "ABSENT")   entry.absentDays++;
    if (row.status === "HALF_DAY") entry.halfDays++;
    absenceByEmp.set(row.employeeId, entry);
  }

  // ── Compute and create payslips inside a transaction ─────────────────────
  const run = await db.$transaction(async (tx) => {
    const payrollRun = await tx.payrollRun.create({
      data: {
        organizationId: ctx.orgId,
        month,
        year,
        status: "DRAFT",
      },
      select: { id: true },
    });

    for (const emp of employees) {
      const structure = emp.salaryStructure as Record<string, string> | null;
      if (!structure?.basic || !structure.hra) continue;

      const attendance = absenceByEmp.get(emp.id) ?? { absentDays: 0, halfDays: 0 };
      const computed   = computePayslip(structure as { basic: string; hra: string }, attendance, slabs);

      await tx.payslip.create({
        data: {
          organizationId: ctx.orgId,
          payrollRunId:   payrollRun.id,
          employeeId:     emp.id,
          daysPresent:    computed.daysPresent,
          lopDays:        computed.lopDays,
          otHours:        computed.otHours,
          earnings: {
            basic:      computed.earnings.basic.toString(),
            hra:        computed.earnings.hra.toString(),
            conveyance: computed.earnings.conveyance.toString(),
            other:      computed.earnings.other.toString(),
            gross:      computed.earnings.gross.toString(),
          },
          deductions: {
            pf:    computed.deductions.pf.toString(),
            esi:   computed.deductions.esi.toString(),
            pt:    computed.deductions.pt.toString(),
            total: computed.deductions.total.toString(),
          },
          netPay: computed.netPay,
        },
      });
    }

    return payrollRun;
  });

  revalidatePath("/payroll");
  return { ok: true, data: { runId: run.id, payslipCount: employees.length } };
}

// ── Approve payroll ───────────────────────────────────────────────────────────

const approveSchema = z.object({
  runId: z.string().min(1),
});

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

function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

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
