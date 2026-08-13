// Make Supervisor dashboard — job kanban summary, overdue cut jobs.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

const STATUS_ORDER = ["QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC", "READY"] as const;
type MakeStatus = (typeof STATUS_ORDER)[number];

export async function MakeSupervisorView({ ctx }: { ctx: RequestContext }) {
  const db  = scoped(ctx);
  const now = new Date();

  const result = await Promise.all([
    db.makeJob.groupBy({
      by:    ["status"],
      where: { organizationId: ctx.orgId, status: { in: [...STATUS_ORDER] } },
      _count: { _all: true },
    }),
    db.makeJob.count({
      where: {
        organizationId: ctx.orgId,
        targetDate:     { lt: now },
        status:         { notIn: ["READY", "DELIVERED"] },
      },
    }),
    db.makeJob.findMany({
      where:   { organizationId: ctx.orgId, status: "READY" },
      select:  { id: true, number: true, completedAt: true },
      orderBy: { completedAt: "desc" },
      take:    5,
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [byStatus, overdue, recentReady] = result;

  const countByStatus = new Map(byStatus.map((r) => [r.status as MakeStatus, r._count._all]));
  const inProgress = STATUS_ORDER.reduce((s, st) => s + (countByStatus.get(st) ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="In Production" value={inProgress} />
        <Kpi label="Overdue" value={overdue} tone={overdue > 0 ? "fault" : undefined} />
        <Kpi label="QC Pending" value={countByStatus.get("QC") ?? 0} tone="warn" />
        <Kpi label="Ready" value={countByStatus.get("READY") ?? 0} tone="good" />
      </div>

      <Card title="Production Kanban">
        <div className="flex flex-wrap gap-3">
          {STATUS_ORDER.map((st) => {
            const n = countByStatus.get(st) ?? 0;
            return (
              <div key={st} className="rounded-[10px] border border-rule bg-surface-2 px-4 py-3 text-center min-w-[90px]">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-text-dim">{st}</div>
                <div className={`mt-1 text-[28px] font-display font-semibold tabular-nums ${n > 0 ? "text-text" : "text-text-faint"}`}>{n}</div>
              </div>
            );
          })}
        </div>

        {recentReady.length > 0 && (
          <div className="mt-4 pt-4 border-t border-rule">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-text-dim mb-2">Ready for dispatch</div>
            <ul className="divide-y divide-rule/40">
              {recentReady.map((j) => (
                <li key={j.id} className="py-2 text-[12.5px] text-text font-data">{j.number}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function DbOffline() {
  return <p className="text-[13px] text-text-dim p-4">Database offline — start Docker to load real data.</p>;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "fault" }) {
  const toneClass = tone === "fault" ? "text-fault" : tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-text";
  return (
    <div className="rounded-[12px] bg-surface border border-rule p-4">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-2 text-[32px] font-display font-semibold tabular-nums leading-none ${toneClass}`}>{value}</div>
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
