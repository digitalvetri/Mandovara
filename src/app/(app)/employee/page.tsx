import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, FileText, Smartphone, TrendingUp } from "lucide-react";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { Topbar } from "@/components/layout/Topbar";
import { LeaveStateBadge, humaniseType } from "./_components/EmployeeChips";
import { AttendanceCTA } from "./_components/AttendanceCTA";

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

  // Primary lookup: Employee.userId → User.id (set when the user logs in for
  // the first time or when HR links the account). Fallback: match by mobile,
  // since mobile is the identity primary key on both tables and Employee rows
  // created before account linking will still have it.
  let employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true, designation: true, department: true, code: true },
  });

  if (!employee) {
    const user = await db.user.findUnique({
      where:  { id: ctx.userId },
      select: { mobile: true, organizationId: true },
    });
    if (user) {
      employee = await db.employee.findFirst({
        where:  { mobile: user.mobile, organizationId: user.organizationId },
        select: { id: true, name: true, designation: true, department: true, code: true },
      });
      // Back-fill the userId link so the primary lookup works next time.
      if (employee) {
        await db.employee.update({
          where: { id: employee.id },
          data:  { userId: ctx.userId },
        });
      }
    }
  }

  // No employee record linked yet — show a minimal greeting so the page
  // doesn't crash in production when HR hasn't linked the account.
  if (!employee) {
    const user = await db.user.findUnique({
      where:  { id: ctx.userId },
      select: { name: true },
    });
    const name = user?.name ?? "there";
    const initials = name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
    return (
      <>
        <Topbar title="Dashboard" eyebrow={todayLabel()} />
        <div className="relative overflow-hidden rounded-[16px] bg-sidebar text-sidebar-text mb-5">
          <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />
          <div aria-hidden className="pointer-events-none absolute inset-0 hero-facets" />
          <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-medium tracking-[0.04em] text-sidebar-dim">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-chrome" />
              {todayLabel()}
            </div>
            <div className="mt-5 flex items-center gap-4">
              <div className="h-14 w-14 rounded-full border border-accent-chrome/30 bg-accent-chrome/15 flex items-center justify-center shrink-0">
                <span className="font-display text-[20px] font-semibold text-accent-chrome">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] text-sidebar-dim">{greet()},</p>
                <h1 className="font-display text-[26px] sm:text-[30px] font-[560] leading-[1.18] tracking-[-0.015em] text-sidebar-text truncate">
                  {name}
                </h1>
                <p className="mt-0.5 text-[12px] text-sidebar-dim">Your employee profile is being set up.</p>
              </div>
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

  const presentDays  = monthRows.filter((r) => r.status === "PRESENT").length;
  const halfDays     = monthRows.filter((r) => r.status === "HALF_DAY").length;
  const absentDays   = monthRows.filter((r) => r.status === "ABSENT").length;
  const leaveDays    = monthRows.filter((r) => r.status === "LEAVE").length;
  const daysElapsed  = now.getUTCDate();

  const approvedLeaves = leaveRows.filter((l) => l.state === "APPROVED");
  const pendingLeaves  = leaveRows.filter((l) => l.state === "PENDING");
  const leavesTaken    = approvedLeaves.reduce((s, l) => s + Number(l.days), 0);

  const initials = employee.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const monthLabel = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  return (
    <>
      <Topbar title="Dashboard" eyebrow={todayLabel()} />

      {/* ── Hero band — dark card like the owner DaySummary ──────── */}
      <div className="relative overflow-hidden rounded-[16px] bg-sidebar text-sidebar-text mb-5">
        <div aria-hidden className="pointer-events-none absolute inset-0 chrome-veil" />
        <div aria-hidden className="pointer-events-none absolute inset-0 hero-facets" />

        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7">
          {/* Date pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-medium tracking-[0.04em] text-sidebar-dim">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-chrome" />
            {todayLabel()}
          </div>

          {/* Avatar + Greeting + Name */}
          <div className="mt-5 flex items-center gap-4">
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

          {/* Attendance CTA — GPS-aware, stays on this page */}
          <AttendanceCTA
            initialInAt={todayAttendance?.inAt?.toISOString() ?? null}
            initialOutAt={todayAttendance?.outAt?.toISOString() ?? null}
            initialStatus={todayAttendance?.status ?? null}
            isLocked={!!todayAttendance?.lockedAt}
          />

          {/* Quick chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { href: "/m/attendance", label: "Attendance PWA",  icon: <Smartphone size={13} strokeWidth={2} /> },
              { href: "/attendance",   label: "View Attendance", icon: <CalendarDays size={13} strokeWidth={2} /> },
              { href: "/payroll",      label: "My Payslips",     icon: <FileText size={13} strokeWidth={2} /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href as Route}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-medium text-sidebar-text hover:bg-white/[0.13] transition-colors"
              >
                <span className="text-accent-chrome">{icon}</span>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

        {/* Month attendance */}
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

        {/* Leave summary */}
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
              <Link
                href={"/leave/apply" as Route}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
              >
                Apply for leave →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Leave requests ──────────────────────────────────────────── */}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function MonthBar({ label, value, total, barColor, numColor }: {
  label: string; value: number; total: number; barColor: string; numColor: string;
}) {
  const pct = total === 0 ? 0 : Math.min((value / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-[12px] text-text-dim">{label}</span>
        <span className={`tabular-nums text-[13px] font-semibold ${value > 0 ? numColor : "text-text-faint"}`}>{value}</span>
      </div>
      <div className="h-[5px] rounded-full bg-rule overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LeaveRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-text-dim">{label}</span>
      <span className={`tabular-nums text-[13px] font-semibold ${color}`}>{value}</span>
    </div>
  );
}
