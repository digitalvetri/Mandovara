"use server";

// Payroll actions — setSalaryStructure (setup), runPayroll (compute
// the month), finalizePayrollRun (lock the month).

import { z } from "zod";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}

import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import {
  computePayslip, rollAttendance,
  type PayrollComponent, type StatSlab,
} from "./runner";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string; fieldErrors?: Record<string, string>;
}

const setStructureSchema = z.object({
  employeeId:    z.string().cuid(),
  ctc:           z.string().trim().min(1, "Enter CTC (annual)"),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

export async function setSalaryStructure(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "employee.viewSalary");
  const parsed = setStructureSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  let ctcPaise: bigint;
  try { ctcPaise = parseINR(d.ctc); }
  catch { return { ok: false, error: "Validation failed",
                   fieldErrors: { ctc: "Could not parse amount" } }; }

  const db = scoped(ctx);
  const created = await db.salaryStructure.upsert({
    where: { employeeId: d.employeeId },
    create: {
      orgId:         ctx.orgId,
      employeeId:    d.employeeId,
      effectiveFrom: new Date(d.effectiveFrom),
      ctc:           ctcPaise,
    },
    update: {
      effectiveFrom: new Date(d.effectiveFrom),
      ctc:           ctcPaise,
    },
    select: { id: true },
  });
  safeRevalidate("/payroll");
  return { ok: true, data: created };
}

// ── runPayroll — compute payslips for a (branch, month, year) ────
//
// - Loads every ACTIVE employee for the branch with a
//   SalaryStructure.
// - Delegates the math to computePayslip (pure), then writes
//   PayrollRun (upsert) + Payslip (createMany).
// - Refuses if a FINALIZED / PAID run exists for this branch+month.
// - Idempotent for DRAFT runs: drops the prior payslips first so
//   re-runs aren't additive.

const runPayrollSchema = z.object({
  branchId: z.string().cuid(),
  month:    z.number().int().min(1).max(12),
  year:     z.number().int().min(2000).max(2100),
});

export async function runPayroll(
  input: unknown,
): Promise<ActionResult<{ payrollRunId: string; count: number; totalPayable: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "payroll.run");
  const parsed = runPayrollSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { branchId, month, year } = parsed.data;

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthStart  = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd    = new Date(Date.UTC(year, month, 1));

  const db = scoped(ctx);

  const existing = await db.payrollRun.findUnique({
    where: {
      orgId_branchId_month_year: {
        orgId: ctx.orgId, branchId, month, year,
      },
    },
    select: { id: true, status: true },
  });
  if (existing && (existing.status === "FINALIZED" || existing.status === "PAID")) {
    return { ok: false, error: `Payroll for ${month}/${year} is ${existing.status} — cannot re-run.` };
  }

  const employees = await db.employee.findMany({
    where:  { branchId, status: "ACTIVE" },
    select: {
      id: true, name: true, code: true,
      salaryStructure: {
        select: {
          id: true,
          components: { select: { name: true, amount: true, isEarning: true }},
        },
      },
    },
  });
  const withStructure = employees.filter((e) => e.salaryStructure);
  if (withStructure.length === 0) {
    return { ok: false, error: "No active employees have a salary structure on file." };
  }

  const slabRows = await db.statutorySlab.findMany({
    select: {
      kind: true, fromAmount: true, toAmount: true,
      employeeRate: true, employerRate: true, flatAmount: true,
    },
  });
  const slabs: StatSlab[] = slabRows.map((r) => ({
    kind:         r.kind,
    fromAmount:   r.fromAmount,
    toAmount:     r.toAmount,
    employeeRate: r.employeeRate == null ? null : Number(r.employeeRate),
    employerRate: r.employerRate == null ? null : Number(r.employerRate),
    flatAmount:   r.flatAmount,
  }));

  const attendanceRows = await db.attendance.findMany({
    where: {
      employeeId: { in: withStructure.map((e) => e.id) },
      date:       { gte: monthStart, lt: monthEnd },
    },
    select: { employeeId: true, status: true },
  });
  const attByEmployee = new Map<string, { status: string }[]>();
  for (const a of attendanceRows) {
    const list = attByEmployee.get(a.employeeId) ?? [];
    list.push({ status: a.status });
    attByEmployee.set(a.employeeId, list);
  }

  interface Computed {
    employeeId: string;
    daysWorked: number; daysLOP: number;
    gross: bigint; deductions: bigint; net: bigint;
    breakup: Record<string, string>;
  }
  const computed: Computed[] = [];
  let totalPayable = 0n;
  for (const emp of withStructure) {
    const components: PayrollComponent[] = emp.salaryStructure!.components.map((c) => ({
      name: c.name, amount: c.amount, isEarning: c.isEarning,
    }));
    const attRoll = rollAttendance(attByEmployee.get(emp.id) ?? []);
    const result = computePayslip({
      components, attendance: attRoll, daysInMonth, slabs,
    });
    const breakupJson: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.breakup))      breakupJson[k] = v.toString();
    for (const [k, v] of Object.entries(result.deductionMap)) breakupJson[k] = v.toString();
    computed.push({
      employeeId: emp.id,
      daysWorked: result.daysWorked, daysLOP: result.daysLOP,
      gross:      result.gross,
      deductions: result.deductions,
      net:        result.net,
      breakup:    breakupJson,
    });
    totalPayable += result.net;
  }

  const runResult = await withTransaction(async (tx: TxClient) => {
    const run = await tx.payrollRun.upsert({
      where: {
        orgId_branchId_month_year: {
          orgId: ctx.orgId, branchId, month, year,
        },
      },
      create: {
        orgId:        ctx.orgId,
        branchId,
        month, year,
        status:       "DRAFT",
        totalPayable,
      },
      update: {
        status:       "DRAFT",
        totalPayable,
      },
      select: { id: true },
    });
    await tx.payslip.deleteMany({ where: { payrollRunId: run.id } });
    await tx.payslip.createMany({
      data: computed.map((c) => ({
        orgId:        ctx.orgId,
        payrollRunId: run.id,
        employeeId:   c.employeeId,
        daysWorked:   c.daysWorked.toString(),
        daysLOP:      c.daysLOP.toString(),
        gross:        c.gross,
        deductions:   c.deductions,
        net:          c.net,
        breakup:      c.breakup,
      })),
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "PayrollRun", entityId: run.id,
        action: "RUN_PAYROLL",
        after: {
          month, year, branchId,
          count: computed.length,
          totalPayable: totalPayable.toString(),
        },
      },
    });
    return run;
  });

  safeRevalidate("/payroll");
  safeRevalidate(`/payroll/${runResult.id}`);
  return {
    ok: true,
    data: {
      payrollRunId: runResult.id,
      count:        computed.length,
      totalPayable: totalPayable.toString(),
    },
  };
}

// ── finalizePayrollRun — locks the month ────────────────────────
const finalizePayrollRunSchema = z.object({
  payrollRunId: z.string().cuid(),
});

export async function finalizePayrollRun(
  input: unknown,
): Promise<ActionResult<{ id: string; status: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "payroll.finalize");
  const parsed = finalizePayrollRunSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { payrollRunId } = parsed.data;

  const db = scoped(ctx);
  const run = await db.payrollRun.findUnique({
    where:  { id: payrollRunId },
    select: { id: true, status: true, branchId: true, month: true, year: true },
  });
  if (!run) return { ok: false, error: "Payroll run not found" };
  if (run.status === "FINALIZED" || run.status === "PAID") {
    return { ok: false, error: `Already ${run.status}` };
  }

  await withTransaction(async (tx: TxClient) => {
    await tx.payrollRun.update({
      where: { id: payrollRunId },
      data:  { status: "FINALIZED", finalizedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        orgId: ctx.orgId, actorId: ctx.userId,
        entityType: "PayrollRun", entityId: payrollRunId,
        action: "FINALIZE_PAYROLL",
        after: { month: run.month, year: run.year, branchId: run.branchId },
      },
    });
  });

  safeRevalidate("/payroll");
  safeRevalidate(`/payroll/${payrollRunId}`);
  safeRevalidate("/attendance");
  return { ok: true, data: { id: payrollRunId, status: "FINALIZED" } };
}

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path.filter((s): s is string | number => typeof s === "string" || typeof s === "number").join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
