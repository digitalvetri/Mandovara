// Hours worked, employee by employee, day 1 to the end of the month.
//
// Owner instruction 2026-08-27: "it will also have the data of how many
// hours the employee is working that current month — it goes from zero
// to thirty one, like that structure."
//
// This is the sheet you check before approving a payroll run. Payroll
// already computed days-present from attendance internally; what nobody
// could see was the working: which days someone was in, which they
// missed, and how long they actually stayed. Approving a salary you
// cannot audit is how disputes start.
//
// Hours come from Attendance.workedMinutes, which check-out stores.
// Rows that predate that (or where someone forgot to check out) fall
// back to the in/out difference, and show as a dash when there is
// nothing to compute from — never as a silent zero, because "absent"
// and "forgot to check out" are different facts and payroll must not
// confuse them.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface DayCell {
  day:     number;
  /** Null when nothing was recorded — absent, or a missing check-out. */
  minutes: number | null;
  status:  string | null;
  offSite: boolean;
  /** Checked in but never checked out — needs a human to fix before payroll. */
  open:    boolean;
}

export interface EmployeeMonthRow {
  employeeId: string;
  name:       string;
  code:       string;
  department: string;
  days:       DayCell[];
  presentDays: number;
  /** Days with a check-in but no check-out. Blocks a clean payroll run. */
  openDays:    number;
  totalMinutes: number;
  offSiteDays:  number;
}

export interface PayrollMonthGrid {
  year:      number;
  month:     number;   // 1-12
  daysInMonth: number;
  rows:      EmployeeMonthRow[];
  /** True when any employee has an unclosed day — surfaced as a warning. */
  hasOpenDays: boolean;
}

function minutesFor(row: {
  workedMinutes: number | null; inAt: Date | null; outAt: Date | null;
}): number | null {
  if (row.workedMinutes != null) return row.workedMinutes;
  if (row.inAt && row.outAt) {
    return Math.max(0, Math.floor((row.outAt.getTime() - row.inAt.getTime()) / 60000));
  }
  return null;
}

export async function getPayrollMonthGrid(
  ctx:   RequestContext,
  year:  number,
  month: number,
): Promise<PayrollMonthGrid> {
  requirePermission(ctx, "payroll.view");
  const db = scoped(ctx);

  // Month bounds in UTC, matching how Attendance.date is stored (@db.Date
  // at UTC midnight — see selfCheckIn).
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to   = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const [employees, attendance] = await Promise.all([
    db.employee.findMany({
      where:   { status: "ACTIVE" },
      orderBy: [{ department: "asc" }, { name: "asc" }],
      select:  { id: true, name: true, code: true, department: true },
    }),
    db.attendance.findMany({
      where:  { date: { gte: from, lt: to } },
      select: {
        employeeId: true, date: true, status: true,
        workedMinutes: true, inAt: true, outAt: true, inOffSite: true,
      },
    }),
  ]);

  const byEmployee = new Map<string, Map<number, typeof attendance[number]>>();
  for (const a of attendance) {
    let m = byEmployee.get(a.employeeId);
    if (!m) { m = new Map(); byEmployee.set(a.employeeId, m); }
    m.set(a.date.getUTCDate(), a);
  }

  const rows: EmployeeMonthRow[] = employees.map((e) => {
    const mine = byEmployee.get(e.id);
    const days: DayCell[] = [];
    let presentDays = 0, openDays = 0, totalMinutes = 0, offSiteDays = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const a = mine?.get(d);
      if (!a) {
        days.push({ day: d, minutes: null, status: null, offSite: false, open: false });
        continue;
      }
      const mins = minutesFor(a);
      const open = a.inAt != null && a.outAt == null;
      if (a.status === "PRESENT" || a.status === "HALF_DAY") presentDays += 1;
      if (open) openDays += 1;
      if (a.inOffSite) offSiteDays += 1;
      if (mins != null) totalMinutes += mins;
      days.push({ day: d, minutes: mins, status: a.status, offSite: a.inOffSite, open });
    }

    return {
      employeeId: e.id,
      name:       e.name,
      code:       e.code,
      department: e.department,
      days, presentDays, openDays, totalMinutes, offSiteDays,
    };
  });

  return {
    year, month, daysInMonth, rows,
    hasOpenDays: rows.some((r) => r.openDays > 0),
  };
}
