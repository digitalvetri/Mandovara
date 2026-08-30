import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { loadAttendance } from "@/modules/attendance/queries";
import { getAttendanceMonthGrid } from "@/modules/payroll/month-grid";
import { MonthHoursGrid } from "@/app/(app)/payroll/_components/MonthHoursGrid";
import { SelfView } from "./_components/AttendanceSelfView";
import { BandCard, Td, Th } from "./_components/AttendanceBadges";
import { AttendanceToolbar } from "./_components/AttendanceToolbar";
import { LeaveRequestList } from "./_components/LeaveRequestList";
import { STATUS_TONE, STATUS_LABEL } from "./_status-styles";

export const dynamic = "force-dynamic";

// ── Page ──────────────────────────────────────────────────────────────────────

interface SearchParams { date?: string; view?: string }

export default async function AttendancePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  if (ctx.permissions.has("attendance.view")) {
    return <ManagerView ctx={ctx} dateParam={params.date} viewParam={params.view} />;
  }
  return <SelfView ctx={ctx} />;
}

/** YYYY-MM-DD from the URL, or today. Rejects anything malformed rather
 *  than handing `new Date("banana")` to a query. */
function resolveDate(raw: string | undefined): { iso: string; date: Date } {
  const today = new Date();
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return { iso: raw, date: d };
  }
  return { iso: today.toISOString().slice(0, 10), date: today };
}

// ── Manager view ──────────────────────────────────────────────────────────────

async function ManagerView({
  ctx, dateParam, viewParam,
}: {
  ctx: Awaited<ReturnType<typeof devContext>>;
  dateParam?: string;
  viewParam?: string;
}) {
  const { iso, date } = resolveDate(dateParam);
  const view = viewParam === "month" ? "month" : "day";
  const isToday = iso === new Date().toISOString().slice(0, 10);

  // The month sheet reuses payroll's grid rather than growing a second
  // one — same builder, guarded on attendance.view instead.
  const [a, monthGrid] = await Promise.all([
    loadAttendance(ctx, date),
    view === "month"
      ? getAttendanceMonthGrid(ctx, date.getUTCFullYear(), date.getUTCMonth() + 1)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <Topbar title="Attendance & Leave" eyebrow={`Team overview · ${isToday ? "today" : iso}`} />

      <AttendanceToolbar date={iso} view={view} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Present"  value={a.present}  tone="solid"  />
        <BandCard label="Absent"   value={a.absent}   tone="fault"  />
        <BandCard label="Half day" value={a.halfDay}  tone="heat"   />
        <BandCard label="On leave" value={a.onLeave}  tone="info"   />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        {view === "month" && monthGrid ? (
          <div className="lg:col-span-2">
            <MonthHoursGrid grid={monthGrid} />
          </div>
        ) : (
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[13px] text-text">
              {isToday ? "Today" : iso} <span className="text-text-muted">· mobile punch (GPS + selfie)</span>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="min-w-[480px] w-full text-[12.5px]">
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
        </div>
        )}

        <div className="rounded-[14px] bg-surface border border-border p-5 h-fit">
          <div className="text-[13px] font-semibold text-text mb-4">Leave requests</div>
          <LeaveRequestList leaves={a.leaves} />
        </div>
      </div>
    </>
  );
}

// ── Employee self-view ─────────────────────────────────────────────────────────
