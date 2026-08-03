import { Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { loadAttendance } from "@/modules/attendance/queries";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  PRESENT: "bg-good/12 text-good",
  ABSENT:  "bg-bad/12 text-bad",
  LATE:    "bg-warn/15 text-warn",
  LEAVE:   "bg-accent/12 text-accent",
} as const;
const STATUS_LABEL = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", LEAVE: "Leave" } as const;

const LEAVE_TONE = {
  APPROVED: "bg-good/12 text-good",
  PENDING:  "bg-warn/15 text-warn",
  REJECTED: "bg-bad/12 text-bad",
} as const;

export default async function AttendancePage() {
  const ctx = await devContext();
  const a = await loadAttendance(ctx);

  return (
    <>
      <Topbar title="Attendance & Leave" eyebrow="Mobile punch with GPS, geo-fence and selfie" />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
        <BandCard label="Present"  value={a.present}  tone="good" />
        <BandCard label="Absent"   value={a.absent}   tone="bad" />
        <BandCard label="Late in"  value={a.late}     tone="warn" />
        <BandCard label="On leave" value={a.onLeave}  tone="accent" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-10">
        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-rule overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <div className="text-[13px] text-text">Today <span className="text-text-dim">· mobile punch (GPS + selfie)</span></div>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-rule text-[10.5px] uppercase tracking-[0.14em] text-text-dim">
                <Th>Employee</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th>Hrs</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {a.punches.map((p, i) => (
                <tr key={i} className="border-b border-rule/70 last:border-0">
                  <Td>
                    <div className="text-text">{p.employeeName}</div>
                    <div className="text-[10.5px] text-text-dim">{p.role}{p.location ? ` · ${p.location}` : ""}</div>
                  </Td>
                  <Td className="tabular text-text-dim">{p.inTime ?? "—"}</Td>
                  <Td className="tabular text-text-dim">{p.outTime ?? "—"}</Td>
                  <Td className="tabular text-text-dim">{p.hours ?? "—"}</Td>
                  <Td>
                    <span className={`inline-block text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${STATUS_TONE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-[14px] bg-surface border border-rule p-5 h-fit">
          <div className="text-[16px] font-medium text-text mb-4">Leave requests</div>
          <ul className="space-y-4">
            {a.leaves.map((l, i) => (
              <li key={i} className="pb-4 border-b border-rule/60 last:border-0 last:pb-0">
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-[12.5px] text-text">{l.employeeName}</div>
                  <span className={`text-[10.5px] font-medium tracking-[0.06em] uppercase px-2 py-0.5 rounded-[3px] ${LEAVE_TONE[l.status]}`}>
                    {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div className="text-[11.5px] text-text-dim">
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

function BandCard({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" | "warn" | "accent" }) {
  const border = tone === "good" ? "border-l-good"
               : tone === "bad"  ? "border-l-bad"
               : tone === "warn" ? "border-l-warn"
               : "border-l-accent";
  return (
    <div className={`rounded-[14px] bg-surface border border-rule border-l-[3px] ${border} p-5`}>
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-dim">{label}</div>
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
