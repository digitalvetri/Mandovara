"use server";

// "Lock Attendance & Process Payroll" — the one button an owner presses
// at month end (owner, 2026-08-29).
//
// The two halves already existed and could not be reached in that order
// from the UI: runPayroll refuses to compute while any attendance row
// for the month is still unlocked (correctly — pay computed from a sheet
// someone can still edit is not pay, it is a draft), but nothing on the
// payroll screen could do the locking. So the run guard read as a dead
// end rather than a sequence.
//
// Locking is deliberately the first step and is NOT rolled back if the
// run then fails. That is the honest behaviour: the month's attendance
// really is closed at that point, and re-running payroll for the same
// month is already blocked by its own duplicate guard. Unlocking is a
// separate, deliberate act.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { runPayroll } from "./actions";

export interface ActionResult<T = unknown> {
  ok: boolean; data?: T; error?: string;
}

const schema = z.object({
  year:  z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export interface LockAndRunSummary {
  lockedRows:   number;
  payslipCount: number;
  runId:        string;
}

/** What the confirmation modal shows before anything is written. */
export async function previewPayrollRun(input: unknown): Promise<ActionResult<{
  month: number; year: number;
  employeesWithStructure: number;
  employeesTotal: number;
  unlockedRows: number;
  alreadyRun: boolean;
}>> {
  const ctx = await devContext();
  requirePermission(ctx, "payroll.view");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid month." };
  const { year, month } = parsed.data;

  const db = scoped(ctx);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 1));

  const [employees, unlockedRows, existing] = await Promise.all([
    db.employee.findMany({
      where:  { status: "ACTIVE" },
      select: { id: true, salaryStructure: true },
    }),
    db.attendance.count({
      where: { date: { gte: monthStart, lt: monthEnd }, lockedAt: null },
    }),
    db.payrollRun.findFirst({ where: { month, year }, select: { id: true } }),
  ]);

  const withStructure = employees.filter((e) => {
    const s = e.salaryStructure as Record<string, unknown> | null;
    return !!s?.["basic"] && !!s["hra"];
  }).length;

  return {
    ok: true,
    data: {
      month, year,
      employeesWithStructure: withStructure,
      employeesTotal: employees.length,
      unlockedRows,
      alreadyRun: existing != null,
    },
  };
}

export async function lockAttendanceAndRunPayroll(
  input: unknown,
): Promise<ActionResult<LockAndRunSummary>> {
  const ctx = await devContext();
  // Both authorities, because this does both things.
  requirePermission(ctx, "attendance.lock");
  requirePermission(ctx, "payroll.run");

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid month." };
  const { year, month } = parsed.data;

  const db = scoped(ctx);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 1));

  const locked = await db.attendance.updateMany({
    where: { date: { gte: monthStart, lt: monthEnd }, lockedAt: null },
    data:  { lockedAt: new Date() },
  });

  const run = await runPayroll({ year, month });
  if (!run.ok) {
    return {
      ok: false,
      error: `${locked.count} attendance record${locked.count === 1 ? "" : "s"} locked, but payroll did not run: ${run.error}`,
    };
  }

  revalidatePath("/payroll");
  revalidatePath("/attendance");
  return {
    ok: true,
    data: {
      lockedRows:   locked.count,
      payslipCount: run.data?.payslipCount ?? 0,
      runId:        run.data?.runId ?? "",
    },
  };
}
