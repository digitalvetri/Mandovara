// Payroll — read side. Returns real DB state or a clean empty view.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// The earnings / deductions JSON stored on Payslip — all values are BigInt paise as strings.
interface PayslipEarnings {
  basic:      string;
  hra:        string;
  conveyance: string;
  other:      string;
  gross:      string;
}
interface PayslipDeductions {
  pf:    string;
  esi:   string;
  pt:    string;
  total: string;
}

export interface PayrollRow {
  employeeId:   string;
  employeeName: string;
  department:   string | null;
  gross:        bigint;
  deductions:   bigint;
  netPay:       bigint;
  payslipId:    string;
}

export interface PayrollView {
  hasRun:          boolean;
  runId:           string | null;
  runLabel:        string | null;
  runStatus:       string | null;
  gross:           bigint;
  deductions:      bigint;
  net:             bigint;
  headcount:       number;
  rows:            PayrollRow[];
  awaitingApproval: boolean;
  employeeCount:   number;
  structuredCount: number;
}

export async function loadPayroll(ctx: RequestContext): Promise<PayrollView> {
  requirePermission(ctx, "payroll.view");
  const db = scoped(ctx);

  const [run, employeeCount] = await Promise.all([
    db.payrollRun.findFirst({
      where:   { organizationId: ctx.orgId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select:  { id: true, month: true, year: true, status: true },
    }),
    db.employee.count({ where: { organizationId: ctx.orgId } }),
  ]);

  if (!run) {
    return {
      hasRun: false, runId: null, runLabel: null, runStatus: null,
      gross: 0n, deductions: 0n, net: 0n, headcount: 0,
      rows: [], awaitingApproval: false,
      employeeCount, structuredCount: 0,
    };
  }

  const payslips = await db.payslip.findMany({
    where:   { payrollRunId: run.id },
    select:  { id: true, employeeId: true, earnings: true, deductions: true, netPay: true },
    orderBy: { netPay: "desc" },
    take:    100,
  });

  const empIds = payslips.map((p) => p.employeeId);
  const emps   = await db.employee.findMany({
    where:  { id: { in: empIds } },
    select: { id: true, name: true, department: true },
  });
  const empById = new Map(emps.map((e) => [e.id, e]));

  const rows: PayrollRow[] = payslips.map((p) => {
    const e        = empById.get(p.employeeId);
    const earn     = p.earnings as unknown as PayslipEarnings;
    const ded      = p.deductions as unknown as PayslipDeductions;
    const grossBig = BigInt(earn.gross ?? "0");
    const dedBig   = BigInt(ded.total  ?? "0");
    return {
      employeeId:   p.employeeId,
      employeeName: e?.name ?? p.employeeId,
      department:   e?.department ?? null,
      gross:        grossBig,
      deductions:   dedBig,
      netPay:       p.netPay,
      payslipId:    p.id,
    };
  });

  const totalGross = rows.reduce((s, r) => s + r.gross, 0n);
  const totalDed   = rows.reduce((s, r) => s + r.deductions, 0n);
  const totalNet   = rows.reduce((s, r) => s + r.netPay, 0n);

  const monthName = new Date(run.year, run.month - 1, 1)
    .toLocaleDateString("en-IN", { month: "long" });

  return {
    hasRun:          true,
    runId:           run.id,
    runLabel:        `${monthName} ${run.year} Payroll`,
    runStatus:       run.status,
    gross:           totalGross,
    deductions:      totalDed,
    net:             totalNet,
    headcount:       rows.length,
    awaitingApproval: run.status === "DRAFT",
    rows,
    employeeCount,
    structuredCount: rows.length, // employees who have payslips in this run
  };
}

export interface EmployeeStructureRow {
  id:           string;
  name:         string;
  designation:  string | null;
  department:   string | null;
  grossMonthly: bigint | null;  // total of components in paise
  hasStructure: boolean;
}

export async function listEmployeesWithStructure(
  ctx: RequestContext,
): Promise<EmployeeStructureRow[]> {
  requirePermission(ctx, "payroll.view");
  const db   = scoped(ctx);
  const emps = await db.employee.findMany({
    where:   { organizationId: ctx.orgId },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, designation: true, department: true, salaryStructure: true },
  });

  return emps.map((e) => {
    const s = e.salaryStructure as Record<string, string> | null;
    let grossMonthly: bigint | null = null;
    if (s?.basic && s.hra) {
      grossMonthly =
        (BigInt(s.basic) + BigInt(s.hra) + BigInt(s.conveyance ?? "0") + BigInt(s.other ?? "0")) * 100n;
    }
    return {
      id:          e.id,
      name:        e.name,
      designation: e.designation,
      department:  e.department,
      grossMonthly,
      hasStructure: s != null,
    };
  });
}
