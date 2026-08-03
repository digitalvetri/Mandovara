// Attendance & Leave — real DB only. Empty views render clean.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface PunchRow {
  employeeName: string;
  role: string | null;
  location: string | null;
  inTime: string | null;
  outTime: string | null;
  hours: string | null;
  status: "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
}

export interface LeaveRow {
  employeeName: string;
  kind: string;
  days: number;
  when: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
}

export interface AttendanceView {
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  employeeCount: number;
  punches: PunchRow[];
  leaves: LeaveRow[];
}

export async function loadAttendance(ctx: RequestContext): Promise<AttendanceView> {
  requirePermission(ctx, "attendance.view");
  const db = scoped(ctx);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [rows, employeeCount, leaveRows] = await Promise.all([
    db.attendance.findMany({
      where: { date: today },
      select: {
        status: true, inTime: true, outTime: true, workedHours: true,
        employee: { select: { name: true, designation: true, department: true } },
      },
      take: 100,
    }),
    db.employee.count(),
    db.leave.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        type: true, status: true, fromDate: true, toDate: true, days: true,
        employee: { select: { name: true } },
      },
    }),
  ]);

  const punches: PunchRow[] = rows.map((r) => ({
    employeeName: r.employee.name,
    role: r.employee.designation ?? r.employee.department,
    location: null,
    inTime: fmt(r.inTime),
    outTime: fmt(r.outTime),
    hours: r.workedHours?.toString() ?? null,
    status: normaliseStatus(r.status),
  }));

  const counts = countStatuses(punches);
  const present = counts["PRESENT"] ?? 0;
  const late    = counts["LATE"] ?? 0;
  const onLeave = counts["LEAVE"] ?? 0;
  const absent  = punches.length > 0
    ? Math.max(0, employeeCount - present - late - onLeave) : 0;

  const leaves: LeaveRow[] = leaveRows.map((l) => ({
    employeeName: l.employee.name,
    kind: humaniseKind(l.type),
    days: Number(l.days),
    when: leaveWhen(l.fromDate, l.toDate),
    status: (l.status === "APPROVED" || l.status === "PENDING" || l.status === "REJECTED")
      ? l.status : "PENDING",
  }));

  return { present, absent, late, onLeave, employeeCount, punches, leaves };
}

function normaliseStatus(s: string): PunchRow["status"] {
  if (s === "PRESENT" || s === "ABSENT" || s === "LATE" || s === "LEAVE") return s;
  return "PRESENT";
}
function countStatuses(rows: PunchRow[]): Record<string, number> {
  const c: Record<string, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
  for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
  return c;
}
function fmt(t: Date | null): string | null {
  if (!t) return null;
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

export interface EmployeeOption { id: string; name: string; designation: string | null; }

export async function listEmployees(ctx: RequestContext): Promise<EmployeeOption[]> {
  requirePermission(ctx, "attendance.view");
  const db = scoped(ctx);
  return db.employee.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, designation: true },
  });
}
