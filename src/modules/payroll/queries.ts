// Payroll — read side. Returns real DB state or a clean empty view.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// ── Employee self-service payslip view ────────────────────────────────────────

export interface MyPayslipEarnings {
  basic:      string;
  hra:        string;
  conveyance: string;
  ot?:        string;
  incentive?: string;
  gross:      string;
}
export interface MyPayslipDeductions {
  pf:       string;
  esi:      string;
  pt:       string;
  tds?:     string;
  advance?: string;
  total:    string;
}

export interface MyPayslipRow {
  id:             string;
  month:          number;
  year:           number;
  runStatus:      string;
  daysPresent:    number;
  lopDays:        number;
  otHours:        number;
  earnings:       MyPayslipEarnings;
  deductions:     MyPayslipDeductions;
  reimbursements: bigint;
  netPay:         bigint;
}

export interface MyPayslipsView {
  employee: { id: string; name: string; designation: string | null; department: string | null } | null;
  payslips:  MyPayslipRow[];
}

// No requirePermission — employees are entitled to read their own payslips.
// Payslip is not in TENANT_SCOPED, so organizationId is added explicitly.
export async function loadMyPayslips(ctx: RequestContext): Promise<MyPayslipsView> {
  const db = scoped(ctx);

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true, designation: true, department: true },
  });
  if (!employee) return { employee: null, payslips: [] };

  const rows = await db.payslip.findMany({
    where:   { employeeId: employee.id, organizationId: ctx.orgId },
    select:  {
      id: true, payrollRunId: true,
      daysPresent: true, lopDays: true, otHours: true,
      earnings: true, deductions: true, reimbursements: true, netPay: true,
    },
    take:    24,
  });

  if (rows.length === 0) return { employee, payslips: [] };

  const runIds = [...new Set(rows.map((r) => r.payrollRunId))];
  const runs   = await db.payrollRun.findMany({
    where:  { id: { in: runIds } },
    select: { id: true, month: true, year: true, status: true },
  });
  const runById = new Map(runs.map((r) => [r.id, r]));

  const payslips: MyPayslipRow[] = rows
    .flatMap((r) => {
      const run = runById.get(r.payrollRunId);
      if (!run) return [];
      return [{
        id:             r.id,
        month:          run.month,
        year:           run.year,
        runStatus:      run.status,
        daysPresent:    Number(r.daysPresent),
        lopDays:        Number(r.lopDays),
        otHours:        Number(r.otHours),
        earnings:       r.earnings  as unknown as MyPayslipEarnings,
        deductions:     r.deductions as unknown as MyPayslipDeductions,
        reimbursements: r.reimbursements,
        netPay:         r.netPay,
      }];
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  return { employee, payslips };
}

/** Payslip JSON holds paise as strings; a missing or malformed component
 *  reads as zero rather than throwing and taking the whole page down. */
function big(v: string | undefined): bigint {
  try { return BigInt(v ?? "0"); } catch { return 0n; }
}

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
  /** The working behind gross and deductions, so an owner can audit a
   *  figure without opening the database (owner, 2026-08-29: "full
   *  access to view complete breakdown details"). Paise. */
  breakdown: {
    basic:       bigint;
    hra:         bigint;
    conveyance:  bigint;
    other:       bigint;
    pf:          bigint;
    esi:         bigint;
    pt:          bigint;
    daysPresent: number;
    lopDays:     number;
  };
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

/**
 * @param period  Month to load. Omitted = the most recent run, which is
 *   what the page did before it grew a month selector (owner,
 *   2026-08-29). With a period, an empty month returns the same
 *   "no run" shape rather than silently showing a different month's pay.
 */
export async function loadPayroll(
  ctx: RequestContext,
  period?: { year: number; month: number },
): Promise<PayrollView> {
  requirePermission(ctx, "payroll.view");
  const db = scoped(ctx);

  const [run, employeeCount] = await Promise.all([
    db.payrollRun.findFirst({
      where:   {
        organizationId: ctx.orgId,
        ...(period ? { year: period.year, month: period.month } : {}),
      },
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
    select:  {
      id: true, employeeId: true, earnings: true, deductions: true, netPay: true,
      daysPresent: true, lopDays: true,
    },
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
      breakdown: {
        basic:       big(earn.basic),
        hra:         big(earn.hra),
        conveyance:  big(earn.conveyance),
        other:       big(earn.other),
        pf:          big(ded.pf),
        esi:         big(ded.esi),
        pt:          big(ded.pt),
        daysPresent: Number(p.daysPresent ?? 0),
        lopDays:     Number(p.lopDays ?? 0),
      },
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
