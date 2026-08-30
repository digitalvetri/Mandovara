import Link from "next/link";
import type { Route } from "next";
import { ListTodo, Briefcase, FileText, TrendingUp, ListChecks } from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { Topbar } from "@/components/layout/Topbar";
import { LeaveStateBadge, humaniseType } from "./_components/EmployeeChips";
import { AttendanceCTA } from "./_components/AttendanceCTA";
import { MyTasksList } from "./_components/MyTasksList";
import { MonthBar, LeaveRow } from "./_components/DashboardBits";
import { listMyOpenTasks } from "@/modules/tasks/queries";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function todayIST() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
function greet() {
  const h = parseInt(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }), 10);
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

export default async function EmployeeDashboardPage() {
  const ctx = await devContext();
  const db  = scoped(ctx);

  let employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true, designation: true, department: true, code: true },
  });

  if (!employee) {
    // Self-heal: no Employee.userId link yet. Try to find one by mobile or
    // email so a logged-in employee doesn't hit the "profile being set up"
    // placeholder just because someone forgot to run the manual link step.
    // Mobile match uses the last 10 digits (Indian format) so
    // "+91 98765 43210" and "919876543210" and "9876543210" all match.
    const user = await db.user.findUnique({
      where:  { id: ctx.userId },
      select: { mobile: true, email: true, organizationId: true },
    });
    if (user) {
      const userDigits = user.mobile.replace(/\D/g, "");
      const userTail10 = userDigits.slice(-10);
      const candidates = await db.employee.findMany({
        where:  {
          organizationId: user.organizationId,
          userId:         null,
        },
        select: { id: true, mobile: true, name: true, designation: true, department: true, code: true },
      });
      const byMobile = candidates.find(
        (e) => e.mobile.replace(/\D/g, "").slice(-10) === userTail10 && userTail10.length === 10,
      );
      if (byMobile) {
        await db.employee.update({ where: { id: byMobile.id }, data: { userId: ctx.userId } });
        employee = {
          id: byMobile.id, name: byMobile.name,
          designation: byMobile.designation, department: byMobile.department, code: byMobile.code,
        };
      }
    }
  }

  if (!employee) {
    const user = await db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const name = user?.name ?? "there";
    const initials = name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
    return (
      <>
        <Topbar title="Dashboard" eyebrow={todayLabel()} />
        <div className="relative overflow-hidden rounded-[16px] bg-sidebar text-sidebar-text mb-5">
          <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />
          <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7 flex items-center gap-4">
            <div className="h-14 w-14 rounded-full border border-accent-chrome/30 bg-accent-chrome/15 flex items-center justify-center shrink-0">
              <span className="font-display text-[20px] font-semibold text-accent-chrome">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] text-sidebar-dim">{greet()},</p>
              <h1 className="font-display text-[26px] sm:text-[30px] font-[560] leading-[1.18] tracking-[-0.015em] text-sidebar-text truncate">{name}</h1>
              <p className="mt-0.5 text-[12px] text-sidebar-dim">Your employee profile is being set up.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const now        = new Date();
  const today      = todayIST();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const tomorrow   = new Date(today.getTime() + 86_400_000);

  const [todayAttendance, monthRows, leaveRows, myTasks, siteVisitCount, followUpCount, fenceBranch] = await Promise.all([
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
    listMyOpenTasks(ctx),
    db.siteVisit.count({ where: { assignedToId: ctx.userId, status: { notIn: ["COMPLETED", "CANCELLED", "NO_SHOW"] }, scheduledAt: { gte: today, lt: tomorrow } } }),
    db.followUp.count({ where: { ownerId: ctx.userId, completedAt: null } }),
    db.branch.findFirst({
      where:  { latitude: { not: null }, longitude: { not: null }, attendanceRadiusM: { not: null } },
      select: { name: true, attendanceRadiusM: true },
    }),
  ]);

  const presentDays    = monthRows.filter((r) => r.status === "PRESENT").length;
  const halfDays       = monthRows.filter((r) => r.status === "HALF_DAY").length;
  const absentDays     = monthRows.filter((r) => r.status === "ABSENT").length;
  const leaveDays      = monthRows.filter((r) => r.status === "LEAVE").length;
  const daysElapsed    = now.getUTCDate();
  const approvedLeaves = leaveRows.filter((l) => l.state === "APPROVED");
  const pendingLeaves  = leaveRows.filter((l) => l.state === "PENDING");
  const leavesTaken    = approvedLeaves.reduce((s, l) => s + Number(l.days), 0);
  const initials       = employee.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const monthLabel     = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  const taskCount      = myTasks.length;
  const hasFocus       = taskCount > 0 || siteVisitCount > 0 || followUpCount > 0;

  return (
    <>
      <Topbar title="Dashboard" eyebrow={todayLabel()} />

      {/* ── Hero — identity + attendance only ── */}
      <div className="relative overflow-hidden rounded-[16px] bg-sidebar text-sidebar-text mb-5">
        <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />
        <div aria-hidden className="pointer-events-none absolute inset-0 hero-facets" />
        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full border border-accent-chrome/30 bg-accent-chrome/15 flex items-center justify-center shrink-0">
              <span className="font-display text-[20px] font-semibold text-accent-chrome">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] text-sidebar-dim">{greet()},</p>
              <h1 className="font-display text-[26px] sm:text-[30px] font-[560] leading-[1.18] tracking-[-0.015em] text-sidebar-text truncate">
                {employee.name}
              </h1>
              <p className="mt-0.5 text-[12px] text-sidebar-dim">
                {employee.designation ?? employee.department}
                <span className="mx-2 opacity-30">·</span>
                <span className="font-data">{employee.code}</span>
              </p>
            </div>
          </div>
          <AttendanceCTA
            initialInAt={todayAttendance?.inAt?.toISOString() ?? null}
            initialOutAt={todayAttendance?.outAt?.toISOString() ?? null}
            initialStatus={todayAttendance?.status ?? null}
            isLocked={!!todayAttendance?.lockedAt}
            fenceBranchName={fenceBranch?.name ?? null}
            fenceRadiusM={fenceBranch?.attendanceRadiusM ?? null}
          />
        </div>
      </div>

      {/* ── Today's Focus + quick links ── */}
      <div className="rounded-[14px] border border-rule bg-surface p-5 mb-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-text-dim mb-3">Today&apos;s Focus</p>
        {hasFocus ? (
          <div className="flex flex-wrap gap-2">
            {taskCount > 0 && <FocusChip label={`${taskCount} Task${taskCount !== 1 ? "s" : ""}`} />}
            {siteVisitCount > 0 && <FocusChip label={`${siteVisitCount} Site Visit${siteVisitCount !== 1 ? "s" : ""}`} />}
            {followUpCount > 0 && <FocusChip label={`${followUpCount} Follow-up${followUpCount !== 1 ? "s" : ""}`} />}
          </div>
        ) : (
          <p className="text-[12.5px] text-text-dim">You&apos;re all caught up. Nothing needs your attention today.</p>
        )}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-rule">
          <Link href={"/tasks" as Route} className="inline-flex items-center gap-2 rounded-full border border-rule px-3.5 py-1.5 text-[12px] font-medium text-text-dim hover:text-text transition-colors">
            <ListTodo size={13} strokeWidth={2} className="text-accent" />My Tasks
          </Link>
          <Link href={"/projects" as Route} className="inline-flex items-center gap-2 rounded-full border border-rule px-3.5 py-1.5 text-[12px] font-medium text-text-dim hover:text-text transition-colors">
            <Briefcase size={13} strokeWidth={2} className="text-accent" />My Projects
          </Link>
        </div>
      </div>

      {/* ── My Tasks — full list with mark-done ── */}
      {taskCount > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks size={13} strokeWidth={2} className="text-accent" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-dim">
              My Tasks <span className="text-text tabular">({taskCount})</span>
            </span>
          </div>
          <MyTasksList tasks={myTasks} />
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-rule">
            <TrendingUp size={13} strokeWidth={2} className="text-accent" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-dim">{monthLabel}</span>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            <MonthBar label="Present"  value={presentDays} total={daysElapsed} barColor="bg-solid"  numColor="text-solid" />
            <MonthBar label="Half-day" value={halfDays}    total={daysElapsed} barColor="bg-heat"   numColor="text-heat" />
            <MonthBar label="Absent"   value={absentDays}  total={daysElapsed} barColor="bg-fault"  numColor="text-fault" />
            <MonthBar label="On leave" value={leaveDays}   total={daysElapsed} barColor="bg-info"   numColor="text-info" />
          </div>
        </div>
        <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-rule">
            <FileText size={13} strokeWidth={2} className="text-accent" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-dim">Leave</span>
          </div>
          <div className="px-5 py-4 space-y-3">
            <LeaveRow label="Approved this year" value={approvedLeaves.length} color="text-solid" />
            <LeaveRow label="Pending approval"   value={pendingLeaves.length}  color="text-heat"  />
            <LeaveRow label="Total days taken"   value={leavesTaken}           color="text-text"  />
            <div className="pt-2">
              <Link href={"/leave/apply" as Route} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline">
                Apply for leave →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Leave requests ── */}
      {leaveRows.length > 0 && (
        <div className="rounded-[14px] border border-rule bg-surface overflow-hidden">
          <div className="px-5 py-3.5 border-b border-rule">
            <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-text-dim">Leave Requests</span>
          </div>
          <ul className="divide-y divide-rule/50">
            {leaveRows.map((l) => (
              <li key={l.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-2/40 transition-colors">
                <div className="min-w-0">
                  <span className="text-[12.5px] font-medium text-text">{humaniseType(l.type)}</span>
                  <span className="ml-2 tabular-nums text-[11.5px] text-text-dim">
                    {fmtDate(l.fromDate)}
                    {l.fromDate.toDateString() !== l.toDate.toDateString() && ` – ${fmtDate(l.toDate)}`}
                  </span>
                  <span className="ml-2 text-[11px] text-text-faint">
                    ({Number(l.days)} day{Number(l.days) !== 1 ? "s" : ""})
                  </span>
                </div>
                <LeaveStateBadge state={l.state} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function FocusChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-rule bg-surface-2 px-3 py-1 text-[12px] font-medium text-text">
      {label}
    </span>
  );
}
