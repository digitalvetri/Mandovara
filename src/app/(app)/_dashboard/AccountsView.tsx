// Accounts dashboard — overdue invoices, receipts this month, advance balances.

import { scoped } from "@/kernel/db/scoped";
import { formatINR } from "@/kernel/money/format";
import type { RequestContext } from "@/kernel/auth/context";

export async function AccountsView({ ctx }: { ctx: RequestContext }) {
  const db         = scoped(ctx);
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const baseResult = await Promise.all([
    db.invoice.findMany({
      where: {
        organizationId: ctx.orgId,
        status:         { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate:        { lt: now },
      },
      select: { id: true, number: true, total: true, dueDate: true, clientId: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    db.receipt.findMany({
      where:   { organizationId: ctx.orgId, date: { gte: monthStart } },
      select:  { id: true, number: true, amount: true, date: true },
      orderBy: { date: "desc" },
      take: 8,
    }),
    db.advance.findMany({
      where: {
        organizationId: ctx.orgId,
        // advances where adjusted < amount (partially or fully unadjusted)
      },
      select: { id: true, amount: true, adjusted: true, receivedAt: true },
      orderBy: { receivedAt: "desc" },
      take: 5,
    }),
  ] as const).catch(() => null);
  if (!baseResult) return <DbOffline />;
  const [overdueInvoices, recentReceipts, pendingAdvances] = baseResult;

  // Invoice has no client relation — fetch names by clientId separately
  const clientIds = [...new Set(overdueInvoices.map((i) => i.clientId))];
  const clients   = clientIds.length
    ? await db.client.findMany({
        where:  { id: { in: clientIds } },
        select: { id: true, name: true },
      }).catch(() => [])
    : [];
  const clientName = new Map(clients.map((c) => [c.id, c.name]));

  const overdueTotal    = overdueInvoices.reduce((s, i) => s + i.total, 0n);
  const receiptsTotal   = recentReceipts.reduce((s, r) => s + r.amount, 0n);
  const pendingAdvTotal = pendingAdvances
    .filter((a) => a.amount > a.adjusted)
    .reduce((s, a) => s + (a.amount - a.adjusted), 0n);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label={`Overdue (${overdueInvoices.length})`} value={formatINR(overdueTotal)} tone={overdueTotal > 0n ? "fault" : "good"} />
        <Kpi label="Collected (MTD)"  value={formatINR(receiptsTotal)} tone="good" />
        <Kpi label="Advance on Hand"  value={formatINR(pendingAdvTotal)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Overdue Invoices">
          {overdueInvoices.length === 0 ? (
            <p className="text-[12px] text-text-faint">No overdue invoices.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {overdueInvoices.map((inv) => {
                const daysOver = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
                return (
                  <li key={inv.id} className="py-2.5 flex justify-between items-center">
                    <div>
                      <div className="text-[12.5px] text-text">{clientName.get(inv.clientId) ?? "—"}</div>
                      <div className="text-[11px] text-text-dim font-data">{inv.number} · {daysOver}d overdue</div>
                    </div>
                    <div className="tabular-nums text-[13px] font-semibold text-fault shrink-0">
                      {formatINR(inv.total)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Receipts this Month">
          {recentReceipts.length === 0 ? (
            <p className="text-[12px] text-text-faint">No receipts this month.</p>
          ) : (
            <ul className="divide-y divide-rule/40">
              {recentReceipts.map((r) => (
                <li key={r.id} className="py-2.5 flex justify-between items-center">
                  <div className="text-[12.5px] text-text-dim font-data">{r.number}</div>
                  <div className="tabular-nums text-[13px] font-semibold text-good">
                    {formatINR(r.amount)}
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

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "fault" }) {
  const toneClass = tone === "fault" ? "text-fault" : tone === "good" ? "text-good" : "text-text";
  return (
    <div className="rounded-[12px] bg-surface border border-rule p-4">
      <div className="text-[10.5px] uppercase tracking-[0.12em] text-text-dim">{label}</div>
      <div className={`mt-2 text-[22px] font-display font-semibold tabular-nums leading-none ${toneClass}`}>{value}</div>
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
