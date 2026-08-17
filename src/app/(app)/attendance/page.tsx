import type { Route } from "next";
import Link from "next/link";
import {
  Clock, CalendarDays, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Info, CalendarCheck2,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { loadAttendance } from "@/modules/attendance/queries";
import { TodayCard } from "./_components/TodayCard";

export const dynamic = "force-dynamic";

// ── Manager view styles ───────────────────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  PRESENT:  "bg-solid/12 text-solid",
  ABSENT:   "bg-fault/12 text-fault",
  HALF_DAY: "bg-heat/15 text-heat",
  LEAVE:    "bg-info/12 text-info",
  HOLIDAY:  "bg-gold/12 text-gold",
  WEEK_OFF: "bg-surface-2 text-text-muted",
};
const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half day",
  LEAVE: "Leave", HOLIDAY: "Holiday", WEEK_OFF: "Week off",
};
const LEAVE_TONE: Record<string, string> = {
  APPROVED: "bg-solid/12 text-solid",
  PENDING:  "bg-heat/15 text-heat",
  REJECTED: "bg-fault/12 text-fault",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AttendancePage() {
  const ctx = await devContext();
  if (ctx.permissions.has("attendance.view")) return <ManagerView ctx={ctx} />;
  return <SelfView ctx={ctx} />;
}

// ── Manager view ──────────────────────────────────────────────────────────────

async function ManagerView({ ctx }: { ctx: Awaited<ReturnType<typeof devContext>> }) {
  const a = await loadAttendance(ctx);

  return (
    <>
      <Topbar title="Attendance & Leave" eyebrow="Team overview · today" />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Present"  value={a.present}  tone="solid"  />
        <BandCard label="Absent"   value={a.absent}   tone="fault"  />
        <BandCard label="Half day" value={a.halfDay}  tone="heat"   />
        <BandCard label="On leave" value={a.onLeave}  tone="info"   />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[13px] text-text">
              Today <span className="text-text-muted">· mobile punch (GPS + selfie)</span>
            </div>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-[10.5px] uppercase tracking-[0.14em] text-text-muted">
                <Th>Employee</Th><Th>In</Th><Th>Out</Th><Th>Hrs</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {a.punches.map((p, i) => (
                <tr key={i} className="border-b border-border/70 last:border-0">
                  <Td>
                    <div className="text-text">{p.employeeName}</div>
                    <div className="text-[10.5px] text-text-muted">{p.designation ?? "—"}</div>
                  </Td>
                  <Td className="tabular-nums text-text-muted">{p.inAt ?? "—"}</Td>
                  <Td className="tabular-nums text-text-muted">{p.outAt ?? "—"}</Td>
                  <Td className="tabular-nums text-text-muted">{p.isLocked ? "🔒" : "—"}</Td>
                  <Td>
                    <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[4px] ${STATUS_TONE[p.status] ?? ""}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-[14px] bg-surface border border-border p-5 h-fit">
          <div className="text-[13px] font-semibold text-text mb-4">Leave requests</div>
          <ul className="space-y-4">
            {a.leaves.map((l, i) => (
              <li key={i} className="pb-4 border-b border-border/60 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-[12.5px] text-text">{l.employeeName}</div>
                  <span className={`text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[4px] ${LEAVE_TONE[l.state] ?? ""}`}>
                    {l.state.charAt(0) + l.state.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="text-[11.5px] text-text-muted">
                  {l.kind} · {l.days} day{l.days === 1 ? "" : "s"} · {l.when}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

// ── Employee self-view ─────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_LABELS  = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const LEAVE_DEFAULTS: Record<string, { label: string; total: number }> = {
  CASUAL:   { label: "Casual Leave",  total: 12 },
  SICK:     { label: "Sick Leave",    total: 8  },
  EARNED:   { label: "Earned Leave",  total: 15 },
  COMP_OFF: { label: "Comp Off",      total: 5  },
};

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", timeZone: "Asia/Kolkata",
  });
}
function fmtDateFull(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function workedStr(inAt: Date, outAt: Date | null, now: Date): string | null {
  if (!inAt) return null;
  const end  = outAt ?? now;
  const mins = Math.max(0, Math.floor((end.getTime() - inAt.getTime()) / 60000));
  const h    = Math.floor(mins / 60);
  const m    = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function calendarDotColor(status: string | undefined): string {
  const m: Record<string, string> = {
    PRESENT:  "bg-solid",
    HALF_DAY: "bg-heat",
    ABSENT:   "bg-fault",
    LEAVE:    "bg-info",
    HOLIDAY:  "bg-gold",
    WEEK_OFF: "bg-text-subtle",
  };
  return m[status ?? ""] ?? "bg-border";
}

async function SelfView({ ctx }: { ctx: Awaited<ReturnType<typeof devContext>> }) {
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
              href={"/m/attendance" as Route}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-[8px] border border-border text-[12.5px] text-text-muted hover:text-text hover:border-border/80 transition-colors"
            >
              <ChevronRight size={13} strokeWidth={2} className="text-gold" />
              Request Leave via App
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

function SummaryChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`rounded-[12px] border border-border ${bg} px-4 py-3 flex items-center justify-between`}>
      <div>
        <p className="text-[10.5px] text-text-muted mb-0.5">{label}</p>
        <p className={`font-data tabular-nums text-[22px] font-semibold leading-none ${color}`}>{value}</p>
      </div>
      <span className="text-[10px] text-text-subtle">days</span>
    </div>
  );
}

function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PRESENT:  { label: "Present",  cls: "bg-solid/12 text-solid"       },
    HALF_DAY: { label: "Half Day", cls: "bg-heat/15 text-heat"         },
    ABSENT:   { label: "Absent",   cls: "bg-fault/12 text-fault"       },
    LEAVE:    { label: "Leave",    cls: "bg-info/12 text-info"         },
    HOLIDAY:  { label: "Holiday",  cls: "bg-gold/12 text-gold"         },
    WEEK_OFF: { label: "Week Off", cls: "bg-surface-2 text-text-muted" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-surface-2 text-text-muted" };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function LeaveStateBadge({ state }: { state: string }) {
  if (state === "APPROVED") return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-solid shrink-0">
      <CheckCircle2 size={11} /> Approved
    </span>
  );
  if (state === "REJECTED") return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-fault shrink-0">
      <XCircle size={11} /> Rejected
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-heat shrink-0">
      <AlertCircle size={11} /> Pending
    </span>
  );
}

function humaniseType(t: string) {
  const map: Record<string, string> = {
    CASUAL: "Casual", SICK: "Sick", EARNED: "Earned",
    UNPAID: "Unpaid", COMP_OFF: "Comp off",
  };
  return map[t] ?? t;
}

function BandCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const accents: Record<string, string> = {
    solid: "border-l-solid", fault: "border-l-fault",
    heat:  "border-l-heat",  info:  "border-l-info",
  };
  return (
    <div className={`rounded-[14px] bg-surface border border-border border-l-[3px] ${accents[tone] ?? ""} p-5`}>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className="mt-3 font-display text-[36px] font-semibold text-text tabular-nums leading-none">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 h-[34px] font-medium text-left">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}
