// HR dashboard — attendance today, pending leave requests, payroll status.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export async function HrView({ ctx }: { ctx: RequestContext }) {
  const db  = scoped(ctx);
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const currentMonth  = now.getMonth() + 1;
  const currentYear   = now.getFullYear();

  const result = await Promise.all([
    // Attendance counts by status for today
    db.attendance.groupBy({
      by: ["status"],
      where: {
        organizationId: ctx.orgId,
        date: { gte: todayStart, lt: tomorrowStart },
      },
      _count: { _all: true },
    }),
    // Count pending leave requests
    db.leave.count({
      where: { organizationId: ctx.orgId, state: "PENDING" },
    }),
    // Pending leave rows for the list
    db.leave.findMany({
      where: { organizationId: ctx.orgId, state: "PENDING" },
      orderBy: { fromDate: "asc" },
      take: 6,
    }),
    // Current month payroll run
    db.payrollRun.findFirst({
      where: { organizationId: ctx.orgId, month: currentMonth, year: currentYear },
      select: { status: true },
    }),
    // Total active headcount
    db.employee.count({
      where: { organizationId: ctx.orgId, status: "ACTIVE" },
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [attendanceRows, pendingLeaveCount, pendingLeaves, payroll, headcount] = result;

  // Resolve employee names for pending leaves via a separate lookup
  const empIds = [...new Set(pendingLeaves.map((l) => l.employeeId))];
  const employees = empIds.length
    ? await db.employee.findMany({
        where: { id: { in: empIds } },
        select: { id: true, name: true },
      }).catch(() => [])
    : [];
  const empName = new Map(employees.map((e) => [e.id, e.name]));

  const countByStatus = new Map(attendanceRows.map((r) => [r.status as string, r._count._all]));
  const presentToday  = countByStatus.get("PRESENT")  ?? 0;
  const absentToday   = countByStatus.get("ABSENT")   ?? 0;
  const halfDayToday  = countByStatus.get("HALF_DAY") ?? 0;
  const markedToday   = presentToday + absentToday + halfDayToday;

  const payrollLabel =
    payroll?.status === "PAID"     ? "Paid"     :
    payroll?.status === "APPROVED" ? "Approved" :
    payroll?.status === "DRAFT"    ? "Draft"    :
    "Not run";
  const payrollTone: "good" | "warn" | undefined =
    payroll?.status === "PAID"     ? "good" :
    payroll?.status === "APPROVED" ? "warn"  :
    undefined;

  const monthName = now.toLocaleDateString("en-IN", { month: "long", timeZone: "Asia/Kolkata" });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          label="Present Today"
          value={presentToday}
          sub={`of ${headcount} staff`}
          tone="good"
        />
        <Kpi
          label="Absent Today"
          value={absentToday}
          sub={`${headcount - markedToday} unmarked`}
          tone={absentToday > 0 ? "fault" : undefined}
        />
        <Kpi
          label="Leave Pending"
          value={pendingLeaveCount}
          tone={pendingLeaveCount > 0 ? "warn" : undefined}
        />
        <KpiText
          label={`Payroll — ${monthName}`}
          value={payrollLabel}
          tone={payrollTone}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Today's Attendance">
          {attendanceRows.length === 0 ? (
            <p className="text-[12px] text-text-faint">No attendance marked yet for today.</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: "Present",  count: presentToday,  color: "bg-good"  },
                { label: "Half Day", count: halfDayToday,  color: "bg-warn"  },
                { label: "Absent",   count: absentToday,   color: "bg-fault" },
              ].map(({ label, count, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-[11.5px] mb-1">
                    <span className="text-text-dim">{label}</span>
                    <span className="tabular-nums font-medium text-text">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all`}
                      style={{ width: headcount > 0 ? `${Math.min(100, (count / headcount) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-text-faint pt-1">
                {headcount - markedToday} of {headcount} employees not yet marked
              </p>
            </div>
          )}
        </Card>

        <Card title="Leave Requests Pending">
          {pendingLeaves.length === 0 ? (
            <p className="text-[12px] text-text-faint">No pending leave requests.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {pendingLeaves.map((l) => (
                <li key={l.id} className="py-2.5">
                  <div className="text-[12.5px] text-text">{empName.get(l.employeeId) ?? "—"}</div>
                  <div className="text-[11px] text-text-dim mt-0.5">
                    <span className="text-accent">{l.type}</span>
                    {" · "}
                    {Number(l.days.toString())}d
                    {" · "}
                    {l.fromDate.toLocaleDateString("en-IN")}
                    {" → "}
                    {l.toDate.toLocaleDateString("en-IN")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function DbOffline() {
  return <p className="text-[13px] text-text-dim p-4">Database offline — start Docker to load real data.</p>;
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: "good" | "warn" | "fault" }) {
  const toneClass = tone === "fault" ? "text-fault" : tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-text";
  return (
    <div className="rounded-[12px] bg-surface border border-rule p-4">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-2 text-[32px] font-display font-semibold tabular-nums leading-none ${toneClass}`}>{value}</div>
      {sub && <div className="mt-1 text-[10.5px] text-text-faint">{sub}</div>}
    </div>
  );
}

function KpiText({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const toneClass = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : "text-text-dim";
  return (
    <div className="rounded-[12px] bg-surface border border-rule p-4">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-2 text-[22px] font-display font-semibold leading-none ${toneClass}`}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="font-display text-[16px] font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
