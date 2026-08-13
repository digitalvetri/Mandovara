// Measurement Executive dashboard — today's visits, drafts pending submission.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export async function MeasureExecView({ ctx }: { ctx: RequestContext }) {
  const db         = scoped(ctx);
  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const result = await Promise.all([
    db.measurement.findMany({
      where: {
        organizationId: ctx.orgId,
        measuredById:   ctx.userId,
        visitedAt:      { gte: todayStart, lte: todayEnd },
      },
      select: {
        id: true, number: true, visitedAt: true, status: true,
        project: { select: { name: true, client: { select: { name: true } } } },
      },
      orderBy: { visitedAt: "asc" },
    }),
    db.measurement.findMany({
      where: {
        organizationId: ctx.orgId,
        measuredById:   ctx.userId,
        status:         "DRAFT",
      },
      select: {
        id: true, number: true, visitedAt: true,
        project: { select: { name: true } },
      },
      orderBy: { visitedAt: "desc" },
      take: 5,
    }),
    db.measurement.count({
      where: {
        organizationId: ctx.orgId,
        measuredById:   ctx.userId,
        visitedAt:      { gt: todayEnd },
      },
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [todayMeasurements, myDrafts, upcomingCount] = result;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Today's Visits"  value={todayMeasurements.length} />
        <Kpi label="Drafts to Submit" value={myDrafts.length} tone={myDrafts.length > 0 ? "warn" : undefined} />
        <Kpi label="Upcoming"         value={upcomingCount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Today's Measurements">
          {todayMeasurements.length === 0 ? (
            <p className="text-[12px] text-text-faint">No measurements scheduled for today.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {todayMeasurements.map((m) => (
                <li key={m.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-[11px] text-text-dim">{m.number}</span>
                    <StatusDot status={m.status} />
                  </div>
                  <div className="text-[12.5px] text-text truncate">{m.project.name}</div>
                  <div className="text-[11px] text-text-dim">{m.project.client.name}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Drafts Pending Submission">
          {myDrafts.length === 0 ? (
            <p className="text-[12px] text-text-faint">All measurements submitted.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {myDrafts.map((m) => (
                <li key={m.id} className="py-2.5">
                  <div className="text-[12.5px] text-text">{m.project.name}</div>
                  <div className="text-[11px] text-text-dim tabular-nums">
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

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  const toneClass = tone === "warn" ? "text-warn" : "text-text";
  return (
    <div className="rounded-[12px] bg-surface border border-rule p-4">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-2 text-[32px] font-display font-semibold tabular-nums leading-none ${toneClass}`}>{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "APPROVED" ? "bg-good" : status === "SUBMITTED" ? "bg-info" : "bg-warn";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-label={status} />;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="font-display text-[16px] font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
