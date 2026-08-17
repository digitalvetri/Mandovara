// Overview tab body — extracted from page.tsx to keep the router
// component small. Renders: 4 KPI cards → Chase List → 2×2 chart
// grid → Attention strip.

import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { orgPrisma } from "@/kernel/db/rls";
import { loadAccountsOverview } from "@/modules/accounts/queries";
import { loadChaseList } from "@/modules/accounts/chase";
import { KpiCard } from "../_components/KpiCard";
import { ChaseList, type ChaseRowUI } from "../_components/ChaseList";
import { InVsOutChart,      type InOutPoint }       from "../_components/InVsOutChart";
import { HowLongOwedBar,    type HowLongOwedSegment }from "../_components/HowLongOwedBar";
import { HowPeoplePayBars,  type PayModeSlice }     from "../_components/HowPeoplePayBars";
import { WhereMoneyGoesBars,type ExpenseHeadUI }    from "../_components/WhereMoneyGoesBars";
import { AttentionStrip } from "../_components/AttentionStrip";
import { DeltaText } from "./_shared";

export async function OverviewTab({
  ctx,
}: { ctx: Awaited<ReturnType<typeof devContext>> }) {
  const [overview, chase, org] = await Promise.all([
    loadAccountsOverview(ctx, {}),
    loadChaseList(ctx, { take: 5 }),
    orgPrisma(ctx.orgId).organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
  ]);

  const kpis = overview.moneyKpis;
  const orgName = org?.name ?? "Mandovara";

  const chaseRows: ChaseRowUI[] = chase.map((c) => ({
    clientId:              c.clientId,
    clientName:            c.clientName,
    clientMobile:          c.clientMobile,
    outstanding:           c.outstanding.toString(),
    oldestLateDays:        c.oldestLateDays,
    lastContactedDaysAgo:  c.lastContactedDaysAgo,
    activePromiseDate:     c.activePromiseDate ? c.activePromiseDate.toISOString() : null,
  }));

  const inOut: InOutPoint[] = overview.monthlyInOut.map((p) => ({
    monthKey: p.monthKey, label: p.label,
    moneyIn:  p.moneyIn.toString(),
    moneyOut: p.moneyOut.toString(),
  }));
  const modeSlices: PayModeSlice[] = overview.paymentModes.map((m) => ({
    mode: m.mode, amount: m.amount.toString(), count: m.count,
  }));
  const heads: ExpenseHeadUI[] = overview.expenseHeads.map((h) => ({
    head: h.head, amount: h.amount.toString(), count: h.count,
  }));
  const owedSegments = buildOwedSegments(overview.aging);

  return (
    <>
      <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="To collect"
          value={formatINR(kpis.toCollect)}
          subLine={
            kpis.toCollect === 0n
              ? "Every bill is settled."
              : kpis.toCollectLate60 > 0n
                ? <><span className="tabular-nums">{formatINR(kpis.toCollectLate60)}</span> is 60+ days late</>
                : `${kpis.toCollectCount} open bill${kpis.toCollectCount === 1 ? "" : "s"}`
          }
          emphasize={kpis.toCollectLate60 > 0n ? "bad" : null}
          helpText="Money your clients still owe you across every unpaid bill."
          href="/accounts?tab=to-collect"
          hero
        />
        <KpiCard
          label="Came in"
          value={formatINR(kpis.cameInThis)}
          subLine={<DeltaText current={kpis.cameInThis} previous={kpis.cameInPrev} />}
          helpText="Money you actually received this month, including advances."
          href="/accounts?tab=received"
        />
        <KpiCard
          label="To pay"
          value={formatINR(kpis.toPay)}
          subLine={
            kpis.toPay === 0n
              ? "Nothing owed right now."
              : kpis.toPayDueWeek > 0n
                ? <><span className="tabular-nums">{formatINR(kpis.toPayDueWeek)}</span> due this week</>
                : "None due this week"
          }
          emphasize={kpis.toPayDueWeek > 0n ? "warn" : null}
          helpText="Money you owe vendors and staff expenses that are approved but not yet paid."
          href="/accounts?tab=to-pay"
        />
        <KpiCard
          label="Spent"
          value={formatINR(kpis.spentThis)}
          subLine={<DeltaText current={kpis.spentThis} previous={kpis.spentPrev} invert />}
          helpText="Everything that went out this month — materials, vendors, salaries, site costs."
          href="/accounts?tab=spending"
        />
      </section>

      <div className="mb-6">
        <ChaseList rows={chaseRows} totalCount={overview.topClients.length} orgName={orgName} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <InVsOutChart points={inOut} />
        <HowLongOwedBar segments={owedSegments} />
        <WhereMoneyGoesBars heads={heads} />
        <HowPeoplePayBars modes={modeSlices} />
      </div>

      <div className="mb-6">
        <AttentionStrip
          chequesPending={{ count: overview.attention.chequesPending.count,
                            amount: overview.attention.chequesPending.amount.toString() }}
          expensesPending={{ count: overview.attention.expensesPending.count,
                             amount: overview.attention.expensesPending.amount.toString() }}
          unmatchedReceipts={{ count: overview.attention.unmatchedReceipts.count,
                               amount: overview.attention.unmatchedReceipts.amount.toString() }}
        />
      </div>
    </>
  );
}

function buildOwedSegments(
  aging: Array<{ key: string; amount: bigint }>,
): HowLongOwedSegment[] {
  const byKey = new Map(aging.map((b) => [b.key, b.amount]));
  const zero = 0n;
  const d60p = (byKey.get("d61_90") ?? zero) + (byKey.get("d90p") ?? zero);
  return [
    { key: "current", label: "Not yet due",  amount: (byKey.get("current") ?? zero).toString() },
    { key: "d0_30",   label: "0–30 late",    amount: (byKey.get("d1_30")   ?? zero).toString() },
    { key: "d31_60",  label: "31–60 late",   amount: (byKey.get("d31_60")  ?? zero).toString() },
    { key: "d60p",    label: "60+ late",     amount: d60p.toString() },
  ];
}
