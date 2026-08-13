// Installer dashboard — today's install route, open snags.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export async function InstallerView({ ctx }: { ctx: RequestContext }) {
  const db         = scoped(ctx);
  const now        = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd    = new Date(todayEnd.getTime() + 6 * 86_400_000);

  const result = await Promise.all([
    db.installVisit.findMany({
      where: {
        organizationId: ctx.orgId,
        scheduledAt:    { gte: todayStart, lte: todayEnd },
        status:         { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
      select: {
        id: true, number: true, scheduledAt: true, status: true,
        project: { select: { name: true, client: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    db.installVisit.findMany({
      where: {
        organizationId: ctx.orgId,
        scheduledAt:    { gt: todayEnd, lte: weekEnd },
        status:         "SCHEDULED",
      },
      select: {
        id: true, number: true, scheduledAt: true,
        project: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    db.snag.findMany({
      where: {
        organizationId: ctx.orgId,
        assignedToId:   ctx.userId,
        status:         { in: ["OPEN", "IN_PROGRESS"] },
      },
      select: {
        id: true, raisedAt: true, description: true, status: true,
        project: { select: { name: true } },
      },
      orderBy: { raisedAt: "asc" },
      take: 5,
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [todayVisits, upcomingVisits, mySnags] = result;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Today's Visits" value={todayVisits.length} tone={todayVisits.length > 0 ? "good" : undefined} />
        <Kpi label="This Week" value={upcomingVisits.length} />
        <Kpi label="Open Snags" value={mySnags.length} tone={mySnags.length > 0 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Today's Route">
          {todayVisits.length === 0 ? (
            <p className="text-[12px] text-text-faint">No installs scheduled today.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {todayVisits.map((v) => (
                <li key={v.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${v.status === "IN_PROGRESS" ? "bg-heat/20 text-heat" : "bg-info/20 text-info"}`}>
                      {v.status.replace("_", " ")}
                    </span>
                    <span className="tabular-nums text-[11px] text-text-dim">
                      {v.scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-text mt-0.5 truncate">{v.project.name}</div>
                  <div className="text-[11px] text-text-dim">{v.project.client.name}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Open Snags">
          {mySnags.length === 0 ? (
            <p className="text-[12px] text-text-faint">No open snags assigned to you.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {mySnags.map((s) => (
                <li key={s.id} className="py-2.5">
                  <div className="text-[12.5px] text-fault truncate">{s.description}</div>
                  <div className="text-[11px] text-text-dim mt-0.5">{s.project.name}</div>
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
