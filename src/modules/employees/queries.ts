// Employees repository.
// Schema: Employee has id, organizationId, userId?, code, name, mobile, designation,
// department, doj DateTime, salaryStructure?, status UserStatus (ACTIVE|SUSPENDED).
// No email, branchId, joinDate, exitDate fields.
// No back-relations to Attendance or Payslip — queried separately.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface EmployeeRow {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email: null;             // Not in schema — always null
  designation: string | null;
  department: string | null;
  branchName: string;      // Not in schema — always "—"
  joinDate: Date;          // maps to schema field doj
  exitDate: null;          // Not in schema — always null
  status: string;
  hasAttendance: boolean;
  hasPayslip: boolean;
}

export interface EmployeesView {
  rows: EmployeeRow[];
  activeCount: number;
  totalCount: number;
}

export async function listEmployees(
  ctx: RequestContext,
  opts: { includeTerminated?: boolean } = {},
): Promise<EmployeesView> {
  requirePermission(ctx, "employee.view");
  const db = scoped(ctx);

  const where = opts.includeTerminated ? {} : { status: "ACTIVE" as const };

  const [rows, totalCount, activeCount] = await Promise.all([
    db.employee.findMany({
      where,
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true, code: true, name: true, mobile: true,
        designation: true, department: true,
        doj: true, status: true,
      },
    }),
    db.employee.count(),
    db.employee.count({ where: { status: "ACTIVE" } }),
  ]);

  if (rows.length === 0) {
    return { rows: [], activeCount, totalCount };
  }

  const empIds = rows.map((r) => r.id);
  const [attendanceSample, payslipSample] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: { in: empIds } },
      select: { employeeId: true },
      distinct: ["employeeId"],
    }),
    db.payslip.findMany({
      where: { employeeId: { in: empIds } },
      select: { employeeId: true },
      distinct: ["employeeId"],
    }),
  ]);

  const hasAttendanceIds = new Set(attendanceSample.map((a) => a.employeeId));
  const hasPayslipIds = new Set(payslipSample.map((p) => p.employeeId));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      mobile: r.mobile,
      email: null,
      designation: r.designation,
      department: r.department,
      branchName: "—",
      joinDate: r.doj,
      exitDate: null,
      status: r.status,
      hasAttendance: hasAttendanceIds.has(r.id),
      hasPayslip: hasPayslipIds.has(r.id),
    })),
    activeCount,
    totalCount,
  };
}
