// Attendance & Leave — read side.
// Employee data joined separately (no Prisma back-relation on Attendance).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface PunchRow {
  employeeId:   string;
  employeeName: string;
  designation:  string | null;
  inAt:         string | null;
  outAt:        string | null;
  status:       "PRESENT" | "HALF_DAY" | "ABSENT" | "LEAVE" | "HOLIDAY" | "WEEK_OFF";
  isLocked:     boolean;
}

export interface LeaveRow {
  id:           string;
  employeeName: string;
  kind:         string;
  days:         number;
  when:         string;
  state:        "APPROVED" | "PENDING" | "REJECTED";
}

export interface AttendanceView {
  present:       number;
  absent:        number;
  halfDay:       number;
  onLeave:       number;
  employeeCount: number;
  punches:       PunchRow[];
  leaves:        LeaveRow[];
}

export async function loadAttendance(ctx: RequestContext): Promise<AttendanceView> {
  requirePermission(ctx, "attendance.view");
  const db    = scoped(ctx);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [rows, employeeCount, leaveRows] = await Promise.all([
    db.attendance.findMany({
      where:   { organizationId: ctx.orgId, date: today },
      select:  { employeeId: true, status: true, inAt: true, outAt: true, lockedAt: true },
      take:    100,
    }),
    db.employee.count({ where: { organizationId: ctx.orgId } }),
    db.leave.findMany({
      where:   { organizationId: ctx.orgId, state: { in: ["PENDING", "APPROVED"] } },
      orderBy: { fromDate: "desc" },
      take:    20,
      select:  { id: true, employeeId: true, type: true, state: true, fromDate: true, toDate: true, days: true },
    }),
  ]);

  // Fetch employee names for attendance and leave rows in one query
  const empIds = [...new Set([
    ...rows.map((r) => r.employeeId),
    ...leaveRows.map((l) => l.employeeId),
  ])];
  const emps = empIds.length > 0
    ? await db.employee.findMany({
        where:  { id: { in: empIds } },
        select: { id: true, name: true, designation: true },
      })
    : [];
  const empMap = new Map(emps.map((e) => [e.id, e]));

  const punches: PunchRow[] = rows.map((r) => ({
    employeeId:   r.employeeId,
    employeeName: empMap.get(r.employeeId)?.name ?? r.employeeId,
    designation:  empMap.get(r.employeeId)?.designation ?? null,
    inAt:         r.inAt ? formatTime(r.inAt) : null,
    outAt:        r.outAt ? formatTime(r.outAt) : null,
    status:       r.status as PunchRow["status"],
    isLocked:     r.lockedAt != null,
  }));

  const leaves: LeaveRow[] = leaveRows.map((l) => ({
    id:           l.id,
    employeeName: empMap.get(l.employeeId)?.name ?? l.employeeId,
    kind:         humaniseKind(l.type),
    days:         Number(l.days),
    when:         leaveWhen(l.fromDate, l.toDate),
    state:        l.state as LeaveRow["state"],
  }));

  const present = punches.filter((p) => p.status === "PRESENT").length;
  const halfDay = punches.filter((p) => p.status === "HALF_DAY").length;
  const onLeave = punches.filter((p) => p.status === "LEAVE").length;
  const absent  = Math.max(0, employeeCount - punches.length); // not in the table = absent

  return { present, absent, halfDay, onLeave, employeeCount, punches, leaves };
}

export interface EmployeeOption {
  id:          string;
  name:        string;
  designation: string | null;
}

export async function listEmployees(ctx: RequestContext): Promise<EmployeeOption[]> {
  requirePermission(ctx, "attendance.view");
  const db = scoped(ctx);
  return db.employee.findMany({
    where:   { organizationId: ctx.orgId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, designation: true },
  });
}

/** Absence and half-day counts for a given employee and month — used by the payroll kernel. */
export async function getAttendanceSummaryForMonth(
  ctx: RequestContext,
  employeeId: string,
  month:      number,
  year:       number,
): Promise<{ absentDays: number; halfDays: number }> {
  requirePermission(ctx, "payroll.view");
  const db         = scoped(ctx);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, month, 1));

  const rows = await db.attendance.findMany({
    where: {
      organizationId: ctx.orgId,
      employeeId,
      date:   { gte: monthStart, lt: monthEnd },
      status: { in: ["ABSENT", "HALF_DAY"] },
    },
    select: { status: true },
  });

  return {
    absentDays: rows.filter((r) => r.status === "ABSENT").length,
    halfDays:   rows.filter((r) => r.status === "HALF_DAY").length,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(t: Date): string {
  return t.toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata",
  });
}
function humaniseKind(k: string): string {
  const map: Record<string, string> = {
    CASUAL: "Casual leave", SICK: "Sick leave", EARNED: "Earned leave",
    UNPAID: "Unpaid leave", COMP_OFF: "Comp off",
  };
  return map[k] ?? k;
}
function leaveWhen(from: Date, to: Date): string {
  const f = from.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  const t = to.toLocaleDateString("en-IN",   { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });
  return f === t ? f : `${f}–${t}`;
}

/**
 * Today's punch state for the signed-in user, for the dashboard band.
 *
 * Returns null when the login has no staff record — the band then omits
 * the control entirely rather than rendering a button that errors on
 * click. Admin's "Link staff records" repairs that case.
 */
export async function getTodayPunch(
  ctx: RequestContext,
): Promise<{ inAt: string | null; outAt: string | null; isLocked: boolean } | null> {
  const db = scoped(ctx);
  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true },
  });
  if (!employee) return null;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const row = await db.attendance.findUnique({
    where:  { employeeId_date: { employeeId: employee.id, date: today } },
    select: { inAt: true, outAt: true, lockedAt: true },
  });

  return {
    inAt:     row?.inAt?.toISOString() ?? null,
    outAt:    row?.outAt?.toISOString() ?? null,
    isLocked: row?.lockedAt != null,
  };
}
