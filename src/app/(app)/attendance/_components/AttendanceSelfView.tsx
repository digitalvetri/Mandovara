/* eslint-disable max-lines -- 328 lines: one component (SelfView); the calendar grid and its data loading are tightly coupled. */
// The self (employee) attendance view (§10 split).

// Attendance calendar helpers and views, split out of page.tsx (§10).

import type { Route } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Info, CalendarCheck2 } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { TodayCard } from "./TodayCard";
import { STATUS_LABEL } from "../page";
import { AttendanceBadge, LeaveStateBadge, SummaryChip , humaniseType} from "./AttendanceBadges";
import { DAY_LABELS, LEAVE_DEFAULTS, MONTH_NAMES, calendarDotColor, fmtDate, fmtDateFull, fmtTime, workedStr } from "./AttendanceViews";

export async function SelfView({ ctx }: { ctx: Awaited<ReturnType<typeof devContext>> }) {
  const db  = scoped(ctx);
  const now = new Date();

  const employee = await db.employee.findUnique({
    where:  { userId: ctx.userId },
    select: { id: true, name: true, designation: true },
  });

  if (!employee) {
    return (
      <>
        <Topbar title="Attendance & Leave" />
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <CalendarCheck2 size={36} strokeWidth={1.3} className="text-text-muted" />
          <p className="text-[14px] font-medium text-text">No employee profile linked</p>
          <p className="text-[13px] text-text-muted max-w-xs">
            Your account isn&apos;t linked to an employee record. Contact your administrator.
          </p>
        </div>
      </>
    );
  }

  const today      = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const yearStart  = new Date(Date.UTC(now.getUTCFullYear(), 3, 1)); // April 1

  const [todayRow, monthRows, allLeaves] = await Promise.all([
    db.attendance.findUnique({
      where:  { employeeId_date: { employeeId: employee.id, date: today } },
      select: { status: true, inAt: true, outAt: true, lockedAt: true },
    }),
    db.attendance.findMany({
      where:   { employeeId: employee.id, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: "desc" },
      select:  { date: true, status: true, inAt: true, outAt: true, lockedAt: true },
    }),
    db.leave.findMany({
      where:   { employeeId: employee.id },
      orderBy: { fromDate: "desc" },
      select:  { id: true, type: true, fromDate: true, toDate: true, days: true, state: true },
    }),
  ]);

  // Monthly stats
  const presentDays = monthRows.filter((r) => r.status === "PRESENT").length;
  const halfDays    = monthRows.filter((r) => r.status === "HALF_DAY").length;
  const absentDays  = monthRows.filter((r) => r.status === "ABSENT").length;
  const leaveDays   = monthRows.filter((r) => r.status === "LEAVE").length;
  const monthLabel  = `${MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

  // Leave balance — approved this financial year
  const approvedThisYear = allLeaves.filter(
    (l) => l.state === "APPROVED" && l.fromDate >= yearStart,
  );
  const usedByType: Record<string, number> = {};
  for (const l of approvedThisYear) {
    usedByType[l.type] = (usedByType[l.type] ?? 0) + Number(l.days);
  }

  // Calendar grid data
  const dayMap: Record<number, string> = {};
  for (const r of monthRows) dayMap[r.date.getUTCDate()] = r.status;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const firstDow    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getUTCDay();
  const todayDay    = now.getUTCDate();

  // Serialize Date → ISO string for client component (no Date objects across server/client boundary)
  const todayCardProps = {
    dateLabel:     fmtDateFull(now),
    initialInAt:   todayRow?.inAt  ? todayRow.inAt.toISOString()  : null,
    initialOutAt:  todayRow?.outAt ? todayRow.outAt.toISOString() : null,
    initialStatus: todayRow?.status ?? null,
    isLocked:      !!todayRow?.lockedAt,
  };

  // History: last 10 records this month
  const historyRows = monthRows.slice(0, 10);

  return (
    <>
      <Topbar
        title="Attendance & Leave"
        eyebrow={`${employee.name}${employee.designation ? ` · ${employee.designation}` : ""}`}
      />

      <p className="text-[13px] text-text-muted mb-5 -mt-1">
        Track your attendance, working hours, and manage leave requests.
      </p>

      {/* ── TODAY'S ATTENDANCE — interactive client component ── */}
      <TodayCard {...todayCardProps} />

      {/* ── MONTHLY SUMMARY ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryChip label="Present"  value={presentDays} color="text-solid"  bg="bg-solid/10"  />
        <SummaryChip label="Half Day" value={halfDays}    color="text-heat"   bg="bg-heat/10"   />
        <SummaryChip label="Absent"   value={absentDays}  color="text-fault"  bg="bg-fault/10"  />
        <SummaryChip label="On Leave" value={leaveDays}   color="text-info"   bg="bg-info/10"   />
      </div>

      {/* ── CALENDAR + HISTORY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 mb-4">

        {/* Calendar */}
        <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-border/60 gap-2">
            <CalendarDays size={13} className="text-gold" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {monthLabel}
            </span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-[0.10em] text-text-subtle py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const status  = dayMap[day];
                const isToday = day === todayDay;
                return (
                  <div
                    key={day}
                    className={[
                      "flex flex-col items-center justify-center py-1.5 rounded-[6px]",
                      isToday ? "bg-gold/12 ring-1 ring-gold/30" : "hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <span className={`text-[11.5px] font-data tabular-nums leading-none ${isToday ? "text-gold font-semibold" : "text-text-muted"}`}>
                      {day}
                    </span>
                    {status ? (
                      <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${calendarDotColor(status)}`} title={STATUS_LABEL[status]} />
                    ) : day < todayDay ? (
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-border/60" />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-border/40">
              {[
                { label: "Present",  cls: "bg-solid"  },
                { label: "Leave",    cls: "bg-info"   },
                { label: "Half Day", cls: "bg-heat"   },
                { label: "Absent",   cls: "bg-fault"  },
                { label: "Holiday",  cls: "bg-gold"   },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${l.cls}`} />
                  <span className="text-[10px] text-text-subtle">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Attendance history table */}
        <div className="rounded-[14px] border border-border bg-surface overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Attendance History
            </span>
            <span className="text-[11px] text-text-subtle">{monthLabel}</span>
          </div>
          {historyRows.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <p className="text-[12.5px] text-text-muted">No records this month yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Date","In","Out","Hrs","Status"].map((h) => (
                      <th key={h} className="px-4 h-9 text-left text-[10px] uppercase tracking-[0.12em] text-text-subtle font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {historyRows.map((r, i) => {
                    const w = workedStr(r.inAt!, r.outAt, now);
                    return (
                      <tr key={i} className="hover:bg-surface-2/60 transition-colors">
                        <td className="px-4 py-2.5 font-data tabular-nums text-text-muted whitespace-nowrap">
                          {fmtDate(r.date)}
                        </td>
                        <td className="px-4 py-2.5 font-data tabular-nums text-text-muted">
                          {r.inAt ? fmtTime(r.inAt) : <span className="text-text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-data tabular-nums text-text-muted">
                          {r.outAt ? fmtTime(r.outAt) : <span className="text-text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-data tabular-nums text-text-muted">
                          {r.inAt && w ? w : <span className="text-text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <AttendanceBadge status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── LEAVE BALANCE + MY REQUESTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Leave Balance */}
        <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              Leave Balance
            </span>
            <span className="text-[11px] text-text-subtle">FY {now.getUTCFullYear()}</span>
          </div>
          <div className="p-4 space-y-3">
            {Object.entries(LEAVE_DEFAULTS).map(([type, { label, total }]) => {
              const used = usedByType[type] ?? 0;
              const bal  = Math.max(0, total - used);
              const pct  = Math.min(100, Math.round((used / total) * 100));
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12.5px] text-text">{label}</span>
                    <span className="font-data tabular-nums text-[12px] text-text-muted">
                      <span className="text-text font-semibold">{bal}</span>
                      <span className="text-text-subtle"> / {total} days</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full bg-solid transition-all" style={{ width: `${100 - pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-4 pb-4">
            <Link
              href={"/leave/apply" as Route}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] border border-border text-[12.5px] text-text-muted hover:text-text hover:border-border/80 transition-colors"
            >
              <ChevronRight size={13} strokeWidth={2} className="text-gold" />
              Apply for Leave →
            </Link>
          </div>
        </div>

        {/* My Requests */}
        <div className="rounded-[14px] border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              My Leave Requests
            </span>
          </div>
          {allLeaves.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-[12.5px] text-text-muted">No leave requests yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {allLeaves.slice(0, 8).map((l) => (
                <div key={l.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12.5px] font-medium text-text">{humaniseType(l.type)}</span>
                      <span className="font-data tabular-nums text-[11px] text-text-subtle">
                        {Number(l.days)} day{Number(l.days) !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-text-muted">
                      {fmtDate(l.fromDate)}
                      {l.fromDate.toDateString() !== l.toDate.toDateString() && ` – ${fmtDate(l.toDate)}`}
                    </div>
                  </div>
                  <LeaveStateBadge state={l.state} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CORRECTION INFO ── */}
      <div className="rounded-[12px] border border-border/60 bg-surface-2/50 px-4 py-3.5 flex items-start gap-3 mb-8">
        <Info size={14} strokeWidth={1.8} className="text-info shrink-0 mt-0.5" />
        <div>
          <p className="text-[12.5px] font-medium text-text mb-0.5">Forgot to check in or out?</p>
          <p className="text-[12px] text-text-muted leading-relaxed">
            Use the Mandovara mobile app to submit an attendance correction request,
            or contact your HR manager. Corrections are reviewed by your supervisor before being applied.
          </p>
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
