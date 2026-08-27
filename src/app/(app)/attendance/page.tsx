import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { loadAttendance } from "@/modules/attendance/queries";
import { SelfView } from "./_components/AttendanceSelfView";
import { BandCard, Td, Th } from "./_components/AttendanceBadges";

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
            <div className="overflow-x-auto text-[13px] text-text">
              Today <span className="text-text-muted">· mobile punch (GPS + selfie)</span>
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
