import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Clock, CalendarDays, Smartphone, FileText } from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { Topbar } from "@/components/layout/Topbar";
import { LeaveStateBadge, QuickLink, StatRow, StatusChip, humaniseType } from "./_components/EmployeeChips";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

function todayIST() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function greeting() {
  const h = new Date().toLocaleString("en-IN", {
    hour: "numeric", hour12: false, timeZone: "Asia/Kolkata",
  });
  const n = parseInt(h, 10);
  if (n < 12) return "Good morning";
  if (n < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default async function EmployeeDashboardPage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  // ── Employee profile ────────────────────────────────────────────────────────
  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true, designation: true, department: true, code: true },
  });
  if (!employee) notFound();

  const today     = todayIST();
  const now       = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // ── Parallel data fetch ─────────────────────────────────────────────────────
  const [todayAttendance, monthRows, leaveRows] = await Promise.all([
    db.attendance.findUnique({
      where:  { employeeId_date: { employeeId: employee.id, date: today } },
      select: { status: true, inAt: true, outAt: true, lockedAt: true },
    }),
    db.attendance.findMany({
      where:  { employeeId: employee.id, date: { gte: monthStart, lt: monthEnd } },
      select: { status: true },
    }),
    db.leave.findMany({
      where:   { employeeId: employee.id },
      orderBy: { fromDate: "desc" },
      take:    8,
      select:  { id: true, type: true, fromDate: true, toDate: true, days: true, state: true, reason: true },
    }),
  ]);

  // ── Month stats ─────────────────────────────────────────────────────────────
  const presentDays = monthRows.filter((r) => r.status === "PRESENT").length;
  const halfDays    = monthRows.filter((r) => r.status === "HALF_DAY").length;
  const absentDays  = monthRows.filter((r) => r.status === "ABSENT").length;
  const leaveDays   = monthRows.filter((r) => r.status === "LEAVE").length;

  // ── Leave summary ───────────────────────────────────────────────────────────
  const approvedLeaves = leaveRows.filter((l) => l.state === "APPROVED");
  const pendingLeaves  = leaveRows.filter((l) => l.state === "PENDING");

  // ── Initials ────────────────────────────────────────────────────────────────
  const initials = employee.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const monthLabel = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  return (
    <>
      <Topbar title="My Dashboard" eyebrow={todayLabel()} />

      {/* ── Profile header ─────────────────────────────────────────── */}
      <div className="mb-6 rounded-[14px] border border-border bg-surface p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 border border-gold/25 shrink-0">
            <span className="font-display text-[20px] font-semibold text-gold">
              {initials}
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted mb-0.5">
              {greeting()}
            </p>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.015em] text-text truncate">
              {employee.name}
            </h1>
            <p className="text-[12.5px] text-text-muted mt-0.5">
              {employee.designation ?? employee.department}
              <span className="mx-2 opacity-40">·</span>
              <span className="font-data text-text-subtle">{employee.code}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">

        {/* Today's attendance */}
        <div className="rounded-[12px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <Clock size={13} strokeWidth={2} className="text-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-muted">
              Today
            </span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {todayAttendance ? (
              <>
                <StatusChip status={todayAttendance.status} />
                {todayAttendance.inAt && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-text-muted">In</span>
                    <span className="font-data tabular-nums text-text">{fmtTime(todayAttendance.inAt)}</span>
                  </div>
                )}
                {todayAttendance.outAt && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-text-muted">Out</span>
                    <span className="font-data tabular-nums text-text">{fmtTime(todayAttendance.outAt)}</span>
                  </div>
                )}
                {!todayAttendance.outAt && todayAttendance.inAt && (
                  <Link
                    href={"/m/attendance" as Route}
                    className="block text-center text-[12px] font-medium text-heat border border-heat/30 rounded-[8px] py-1.5 hover:bg-heat/10 transition-colors"
                  >
                    Punch Out →
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="text-[12.5px] text-text-muted">Not yet punched in.</p>
                <Link
                  href={"/m/attendance" as Route}
                  className="block text-center text-[12px] font-semibold text-ink bg-gold rounded-[8px] py-2 hover:bg-gold-strong transition-colors"
                >
                  Punch In Now
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Month summary */}
        <div className="rounded-[12px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <CalendarDays size={13} strokeWidth={2} className="text-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-muted">
              {monthLabel}
            </span>
          </div>
          <div className="px-4 py-4 space-y-2.5">
            <StatRow label="Present" value={presentDays} color="text-solid" />
            <StatRow label="Half-day" value={halfDays}    color="text-heat"  />
            <StatRow label="Absent"   value={absentDays}  color="text-fault" />
            <StatRow label="On leave" value={leaveDays}   color="text-info"  />
          </div>
        </div>

        {/* Leave summary */}
        <div className="rounded-[12px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
            <FileText size={13} strokeWidth={2} className="text-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-muted">
              Leave
            </span>
          </div>
          <div className="px-4 py-4 space-y-2.5">
            <StatRow label="Approved this year" value={approvedLeaves.length} color="text-solid" />
            <StatRow label="Pending approval"   value={pendingLeaves.length}  color="text-heat"  />
            <StatRow
              label="Total days taken"
              value={approvedLeaves.reduce((s, l) => s + Number(l.days), 0)}
              color="text-text"
            />
          </div>
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="mb-6 rounded-[12px] border border-border bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-muted mb-3">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <QuickLink href="/m/attendance" icon={<Smartphone size={14} />} label="Attendance PWA" />
          <QuickLink href="/attendance"   icon={<CalendarDays size={14} />} label="View Attendance" />
          <QuickLink href="/payroll"      icon={<FileText size={14} />}    label="My Payslips" />
        </div>
      </div>

      {/* ── Recent leave requests ───────────────────────────────────── */}
      {leaveRows.length > 0 && (
        <div className="rounded-[12px] border border-border bg-surface overflow-hidden pb-2">
          <div className="px-4 py-3 border-b border-border/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-muted">
              Leave Requests
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {leaveRows.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 text-[12.5px]">
                <div className="min-w-0">
                  <span className="text-text font-medium">
                    {humaniseType(l.type)}
                  </span>
                  <span className="ml-2 text-text-muted tabular-nums">
                    {fmtDate(l.fromDate)}
                    {l.fromDate.toDateString() !== l.toDate.toDateString() &&
                      ` – ${fmtDate(l.toDate)}`}
                  </span>
                  <span className="ml-2 text-text-subtle">
                    ({Number(l.days)} day{Number(l.days) !== 1 ? "s" : ""})
                  </span>
                </div>
                <LeaveStateBadge state={l.state} />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
