// Sales / Designer dashboard — lead funnel, quote pipeline, follow-ups.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export async function SalesView({ ctx }: { ctx: RequestContext }) {
  const db   = scoped(ctx);
  const now  = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const result = await Promise.all([
    db.lead.groupBy({
      by: ["stage"],
      where: { organizationId: ctx.orgId },
      _count: { _all: true },
    }),
    db.quotation.groupBy({
      by: ["status"],
      where: { organizationId: ctx.orgId, ownerId: ctx.userId },
      _count: { _all: true },
    }),
    db.followUp.count({
      where: {
        organizationId: ctx.orgId,
        ownerId:         ctx.userId,
        completedAt:     null,
        dueAt:           { lte: todayEnd },
      },
    }),
    db.project.findMany({
      where: {
        organizationId: ctx.orgId,
        ownerId:        ctx.userId,
        stage:          { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: {
        id: true, name: true, stage: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [leadCounts, quoteCounts, dueFollowUps, myProjects] = result;

  const stageOrder = ["NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "MEASURED", "QUOTED", "NEGOTIATION", "WON", "LOST"];
  const leadByStage = new Map(leadCounts.map((r) => [r.stage as string, r._count._all]));
  const quoteByStatus = new Map(quoteCounts.map((r) => [r.status, r._count._all]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Due Follow-ups" value={dueFollowUps} tone={dueFollowUps > 0 ? "warn" : "good"} />
        <Kpi label="My Projects" value={myProjects.length} />
        <Kpi label="Quotes Sent" value={quoteByStatus.get("SENT") ?? 0} />
        <Kpi label="Quotes Draft" value={quoteByStatus.get("DRAFT") ?? 0} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Lead Pipeline">
          <div className="space-y-2">
            {stageOrder.map((stage) => {
              const count = leadByStage.get(stage) ?? 0;
              return count > 0 ? (
                <div key={stage} className="flex justify-between items-center text-[12.5px]">
                  <span className="text-text-dim">{stage.replace(/_/g, " ")}</span>
                  <span className="tabular-nums font-medium text-text">{count}</span>
                </div>
              ) : null;
            })}
          </div>
        </Card>

        <Card title="My Active Projects">
          {myProjects.length === 0 ? (
            <p className="text-[12px] text-text-faint">No active projects assigned.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {myProjects.map((p) => (
                <li key={p.id} className="py-2.5">
                  <div className="text-[12.5px] text-text truncate">{p.name}</div>
                  <div className="text-[11px] text-text-dim mt-0.5">
                    {p.client.name} · <span className="text-accent">{p.stage}</span>
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

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  const toneClass = tone === "warn" ? "text-warn" : tone === "bad" ? "text-fault" : tone === "good" ? "text-good" : "text-text";
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
