// Store dashboard — allocation queue, low stock, pending GRNs.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export async function StoreView({ ctx }: { ctx: RequestContext }) {
  const db = scoped(ctx);

  const result = await Promise.all([
    db.purchaseOrder.count({
      where: { organizationId: ctx.orgId, status: { in: ["SENT", "PARTIAL"] } },
    }),
    db.gRN.findMany({
      where:   { organizationId: ctx.orgId },
      select:  { id: true, number: true, receivedAt: true, vendorId: true },
      orderBy: { receivedAt: "desc" },
      take:    5,
    }),
    db.stockBalance.count({
      where: {
        organizationId: ctx.orgId,
        quantity:        { lte: 2 },
      },
    }),
    db.stockBalance.findMany({
      where: {
        organizationId: ctx.orgId,
        dyeLot:          { not: null },
      },
      select: {
        quantity: true, reserved: true, dyeLot: true,
        colourway: { select: { code: true, colourName: true } },
      },
      orderBy: { quantity: "asc" },
      take: 8,
    }),
  ] as const).catch(() => null);
  if (!result) return <DbOffline />;
  const [pendingPOs, recentGrns, lowStockCount, stockBalances] = result;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Pending POs"  value={pendingPOs} tone={pendingPOs > 0 ? "warn" : undefined} />
        <Kpi label="Low Stock SKUs" value={lowStockCount} tone={lowStockCount > 0 ? "warn" : undefined} />
        <Kpi label="Dye-lot Balances" value={stockBalances.length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Dye-lot Stock">
          {stockBalances.length === 0 ? (
            <p className="text-[12px] text-text-faint">No dye-lot stock on hand.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {stockBalances.map((b, i) => {
                const avail = Number(b.quantity.toString()) - Number(b.reserved.toString());
                return (
                  <li key={i} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-[12.5px] text-text">{b.colourway.colourName}</div>
                      <div className="text-[11px] text-text-dim font-data">{b.dyeLot}</div>
                    </div>
                    <div className={`tabular-nums text-[13px] font-semibold ${avail <= 2 ? "text-fault" : "text-text"}`}>
                      {avail.toFixed(3)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent GRNs">
          {recentGrns.length === 0 ? (
            <p className="text-[12px] text-text-faint">No GRNs yet.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {recentGrns.map((g) => (
                <li key={g.id} className="py-2.5">
                  <div className="text-[12.5px] text-text font-data">{g.number}</div>
                  <div className="text-[11px] text-text-dim tabular-nums">
                    {g.receivedAt.toLocaleDateString("en-IN")}
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5">
      <div className="font-display text-[16px] font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}
