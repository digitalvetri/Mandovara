// Employees repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface EmployeeRow {
  id: string;
  code: string;
  name: string;
  mobile: string;
  email: string | null;
  designation: string | null;
  department: string | null;
  branchId: string;
  branchName: string;
  joinDate: Date;
  exitDate: Date | null;
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
  const [rows, branches, totalCount, activeCount] = await Promise.all([
    db.employee.findMany({
      where: opts.includeTerminated
        ? {}
        : { status: { in: ["ACTIVE", "ON_LEAVE"] } },
      orderBy: { name: "asc" },
      take: 200,
      select: {
        id: true, code: true, name: true, mobile: true, email: true,
        designation: true, department: true, branchId: true,
        joinDate: true, exitDate: true, status: true,
        _count: { select: { attendance: true, payslips: true } },
      },
    }),
    db.branch.findMany({ select: { id: true, name: true } }),
    db.employee.count(),
    db.employee.count({ where: { status: { in: ["ACTIVE", "ON_LEAVE"] } } }),
  ]);
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  return {
    rows: rows.map((r) => ({
      id: r.id, code: r.code, name: r.name, mobile: r.mobile, email: r.email,
      designation: r.designation, department: r.department,
      branchId: r.branchId, branchName: branchNameById.get(r.branchId) ?? "?",
      joinDate: r.joinDate, exitDate: r.exitDate, status: r.status,
      hasAttendance: r._count.attendance > 0,
      hasPayslip: r._count.payslips > 0,
    })),
    activeCount, totalCount,
  };
}

// Small picker for the /m/attendance PWA — active employees only.
export interface EmployeePickerRow {
  id: string; code: string; name: string; department: string | null;
}
export async function listEmployeesForPicker(
  ctx: RequestContext,
): Promise<EmployeePickerRow[]> {
  requirePermission(ctx, "employee.view");
  const db = scoped(ctx);
  const rows = await db.employee.findMany({
    where:   { status: { in: ["ACTIVE", "ON_LEAVE"] } },
    orderBy: { name: "asc" },
    take:    500,
    select:  { id: true, code: true, name: true, department: true },
  });
  return rows;
}
