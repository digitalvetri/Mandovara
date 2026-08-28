import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { loadAttendance } from "@/modules/attendance/queries";
import { SelfView } from "./_components/AttendanceSelfView";
import { BandCard, Td, Th } from "./_components/AttendanceBadges";
import { AttendanceToolbar } from "./_components/AttendanceToolbar";
import { LeaveRequestList } from "./_components/LeaveRequestList";

export const dynamic = "force-dynamic";

// ── Manager view styles ───────────────────────────────────────────────────────

export const STATUS_TONE: Record<string, string> = {
  PRESENT:  "bg-solid/12 text-solid",
  ABSENT:   "bg-fault/12 text-fault",
  HALF_DAY: "bg-heat/15 text-heat",
  LEAVE:    "bg-info/12 text-info",
  HOLIDAY:  "bg-gold/12 text-gold",
  WEEK_OFF: "bg-surface-2 text-text-muted",
};
export const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half day",
  LEAVE: "Leave", HOLIDAY: "Holiday", WEEK_OFF: "Week off",
};
export const LEAVE_TONE: Record<string, string> = {
  APPROVED: "bg-solid/12 text-solid",
  PENDING:  "bg-heat/15 text-heat",
  REJECTED: "bg-fault/12 text-fault",
};

// ── Page ──────────────────────────────────────────────────────────────────────

interface SearchParams { date?: string }

export default async function AttendancePage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx = await devContext();
  if (ctx.permissions.has("attendance.view")) {
    return <ManagerView ctx={ctx} dateParam={params.date} />;
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
  ctx, dateParam,
}: { ctx: Awaited<ReturnType<typeof devContext>>; dateParam?: string }) {
  const { iso, date } = resolveDate(dateParam);
  const a = await loadAttendance(ctx, date);
  const isToday = iso === new Date().toISOString().slice(0, 10);

  return (
    <>
      <Topbar title="Attendance & Leave" eyebrow={`Team overview · ${isToday ? "today" : iso}`} />

      <AttendanceToolbar date={iso} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Present"  value={a.present}  tone="solid"  />
        <BandCard label="Absent"   value={a.absent}   tone="fault"  />
        <BandCard label="Half day" value={a.halfDay}  tone="heat"   />
        <BandCard label="On leave" value={a.onLeave}  tone="info"   />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="overflow-x-auto text-[13px] text-text">
              {isToday ? "Today" : iso} <span className="text-text-muted">· mobile punch (GPS + selfie)</span>
            </div>
          </div>
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

        <div className="rounded-[14px] bg-surface border border-border p-5 h-fit">
          <div className="text-[13px] font-semibold text-text mb-4">Leave requests</div>
          <LeaveRequestList leaves={a.leaves} />
        </div>
      </div>
    </>
  );
}

// ── Employee self-view ─────────────────────────────────────────────────────────
