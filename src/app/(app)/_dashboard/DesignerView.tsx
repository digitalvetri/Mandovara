// Designer dashboard — project board, measurements awaiting review, quote pipeline.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export async function DesignerView({ ctx }: { ctx: RequestContext }) {
  const db      = scoped(ctx);
  const now     = new Date();
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const result = await Promise.all([
    // Active projects I own
    db.project.findMany({
      where: {
        organizationId: ctx.orgId,
        ownerId: ctx.userId,
        stage: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: {
        id: true, name: true, stage: true,
        client: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // Quotation status breakdown for quotes I own
    db.quotation.groupBy({
      by: ["status"],
      where: { organizationId: ctx.orgId, ownerId: ctx.userId },
      _count: { _all: true },
    }),
    // Measurements SUBMITTED on my projects — awaiting review/approval
    db.measurement.findMany({
      where: {
        organizationId: ctx.orgId,
        project: { ownerId: ctx.userId },
        status: "SUBMITTED",
      },
      select: {
        id: true, number: true, visitedAt: true,
        project: { select: { name: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 6,
    }),
    // Follow-ups due today or overdue
    db.followUp.count({
      where: {
        organizationId: ctx.orgId,
        ownerId: ctx.userId,
        completedAt: null,
        dueAt: { lte: todayEnd },
      },
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [myProjects, quoteCounts, pendingMeasurements, dueFollowUps] = result;

  const quoteByStatus = new Map(quoteCounts.map((r) => [r.status as string, r._count._all]));
  const sentQuotes    = quoteByStatus.get("SENT") ?? 0;
  const draftQuotes   = quoteByStatus.get("DRAFT") ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="My Projects"     value={myProjects.length} />
        <Kpi label="Quotes Sent"     value={sentQuotes}        tone={sentQuotes > 0 ? "good" : undefined} />
        <Kpi label="To Review"       value={pendingMeasurements.length} tone={pendingMeasurements.length > 0 ? "warn" : undefined} />
        <Kpi label="Follow-ups Due"  value={dueFollowUps}      tone={dueFollowUps > 0 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="My Active Projects">
          {myProjects.length === 0 ? (
            <p className="text-[12px] text-text-faint">No active projects assigned to you.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {myProjects.map((p) => (
                <li key={p.id} className="py-2.5">
                  <div className="text-[12.5px] text-text truncate">{p.name}</div>
                  <div className="text-[11px] text-text-dim mt-0.5">
                    {p.client.name} ·{" "}
                    <span className="text-accent">{p.stage.replace(/_/g, " ")}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {draftQuotes > 0 && (
            <div className="mt-3 pt-3 border-t border-rule/40 text-[11.5px] text-text-dim">
              {draftQuotes} quote{draftQuotes !== 1 ? "s" : ""} in draft
            </div>
          )}
        </Card>

        <Card title="Measurements Awaiting Review">
          {pendingMeasurements.length === 0 ? (
            <p className="text-[12px] text-text-faint">All measurements reviewed.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {pendingMeasurements.map((m) => (
                <li key={m.id} className="py-2.5">
                  <div className="text-[12.5px] text-text truncate">{m.project.name}</div>
                  <div className="text-[11px] text-text-dim font-data">
                    {m.number} · {m.visitedAt.toLocaleDateString("en-IN")}
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

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  const toneClass = tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-text";
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
