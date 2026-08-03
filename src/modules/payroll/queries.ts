// Payroll — read side. Returns real DB state or a clean empty view.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface PayrollRow {
  employeeName: string;
  department: string | null;
  gross: bigint;
  deductions: bigint;
  net: bigint;
  payslipId: string | null;
}

export interface PayrollView {
  hasRun: boolean;
  runLabel: string | null;
  runStatus: string | null;
  gross: bigint;
  deductions: bigint;
  net: bigint;
  headcount: number;
  rows: PayrollRow[];
  awaitingApproval: boolean;
  employeeCount: number;
  structureCount: number;
}

export async function loadPayroll(ctx: RequestContext): Promise<PayrollView> {
  requirePermission(ctx, "payroll.view");
  const db = scoped(ctx);
  const [run, employeeCount, structureCount] = await Promise.all([
    db.payrollRun.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, month: true, year: true, status: true },
    }),
    db.employee.count(),
    db.salaryStructure.count(),
  ]);

  if (!run) {
    return {
      hasRun: false, runLabel: null, runStatus: null,
      gross: 0n, deductions: 0n, net: 0n, headcount: 0,
      rows: [], awaitingApproval: false,
      employeeCount, structureCount,
    };
  }

  const payslips = await db.payslip.findMany({
    where: { payrollRunId: run.id },
    select: { id: true, gross: true, deductions: true, net: true, employeeId: true },
    orderBy: { net: "desc" },
    take: 60,
  });
  const emps = await db.employee.findMany({
    where: { id: { in: payslips.map((p) => p.employeeId) } },
    select: { id: true, name: true, department: true },
  });
  const empById = new Map(emps.map((e) => [e.id, e]));
  const rows = payslips.map((p) => {
    const e = empById.get(p.employeeId);
    return {
      employeeName: e?.name ?? p.employeeId,
      department:   e?.department ?? null,
      gross: p.gross, deductions: p.deductions, net: p.net,
      payslipId: p.id,
    };
  });
  const gross = rows.reduce((s, r) => s + r.gross, 0n);
  const deductions = rows.reduce((s, r) => s + r.deductions, 0n);
  const net = rows.reduce((s, r) => s + r.net, 0n);

  const monthName = new Date(run.year, run.month - 1, 1)
    .toLocaleDateString("en-IN", { month: "long" });

  return {
    hasRun: true,
    runLabel: `${monthName} ${run.year} Payroll Run`,
    runStatus: `Status: ${run.status}`,
    gross, deductions, net, headcount: rows.length,
    awaitingApproval: run.status !== "FINALIZED",
    rows, employeeCount, structureCount,
  };
}

export interface EmployeeStructureRow {
  id: string;
  name: string;
  designation: string | null;
  department: string | null;
  ctc: bigint | null;
  hasStructure: boolean;
}

export async function listEmployeesWithStructure(ctx: RequestContext): Promise<EmployeeStructureRow[]> {
  requirePermission(ctx, "payroll.view");
  const db = scoped(ctx);
  const emps = await db.employee.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, designation: true, department: true,
      salaryStructure: { select: { ctc: true } },
    },
  });
  return emps.map((e) => ({
    id: e.id, name: e.name, designation: e.designation, department: e.department,
    ctc: e.salaryStructure?.ctc ?? null,
    hasStructure: e.salaryStructure != null,
  }));
}
