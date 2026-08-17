import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { prisma } from "@/kernel/db/client";
import { listReceipts } from "@/modules/receipts/queries";
import { loadAccountsOverview } from "@/modules/accounts/queries";
import { loadChaseList } from "@/modules/accounts/chase";
import { ReceiptsTable } from "./_components/ReceiptsTable";
import { KpiCard } from "./_components/KpiCard";
import { ChaseList, type ChaseRowUI } from "./_components/ChaseList";
import { InVsOutChart,   type InOutPoint }        from "./_components/InVsOutChart";
import { HowLongOwedBar, type HowLongOwedSegment }from "./_components/HowLongOwedBar";
import { HowPeoplePayBars, type PayModeSlice }    from "./_components/HowPeoplePayBars";
import { WhereMoneyGoesBars, type ExpenseHeadUI } from "./_components/WhereMoneyGoesBars";
import { AttentionStrip } from "./_components/AttentionStrip";
import { Tabs, type TabDef } from "@/components/ui/Tabs";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "overview",    label: "Overview" },
  { key: "to-collect",  label: "To Collect" },
  { key: "received",    label: "Received" },
  { key: "to-pay",      label: "To Pay" },
  { key: "spending",    label: "Spending" },
];

interface SearchParams { q?: string; page?: string; sort?: string; tab?: string }

export default async function AccountsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx    = await devContext();
  const activeTab = TABS.find((t) => t.key === params.tab)?.key ?? "overview";

  return (
    <>
      <Topbar
        title="Money"
        eyebrow="Every payment coming in and going out — at a glance"
        actions={
          <Link href={"/accounts/new" as Route}>
            <PrimaryButton>+ Record Payment</PrimaryButton>
          </Link>
        }
      />
      <Tabs tabs={TABS} className="mb-6" />
      {activeTab === "overview"    ? <OverviewTab ctx={ctx} /> : null}
      {activeTab === "to-collect"  ? <ComingSoon title="To Collect" /> : null}
      {activeTab === "received"    ? <ReceivedTab ctx={ctx} searchParams={params} /> : null}
      {activeTab === "to-pay"      ? <ComingSoon title="To Pay"     /> : null}
      {activeTab === "spending"    ? <ComingSoon title="Spending"   /> : null}
    </>
  );
}

// ── Overview tab ─────────────────────────────────────────────────

async function OverviewTab({ ctx }: { ctx: Awaited<ReturnType<typeof devContext>> }) {
  const [overview, chase, org] = await Promise.all([
    loadAccountsOverview(ctx, {}),
    loadChaseList(ctx, { take: 5 }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
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

  // Serialize chart data across the RSC → client boundary.
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
      {/* 4 KPI cards — §5.3 */}
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

      {/* Chase list — the hero of the page (§16) */}
      <div className="mb-6">
        <ChaseList
          rows={chaseRows}
          totalCount={overview.topClients.length}
          orgName={orgName}
        />
      </div>

      {/* 2×2 chart grid — no pies, all bars (§7) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <InVsOutChart points={inOut} />
        <HowLongOwedBar segments={owedSegments} />
        <WhereMoneyGoesBars heads={heads} />
        <HowPeoplePayBars modes={modeSlices} />
      </div>

      {/* Needs your attention — only if any count > 0 */}
      <div className="mb-6">
        <AttentionStrip
          chequesPending={{
            count: overview.attention.chequesPending.count,
            amount: overview.attention.chequesPending.amount.toString(),
          }}
          expensesPending={{
            count: overview.attention.expensesPending.count,
            amount: overview.attention.expensesPending.amount.toString(),
          }}
          unmatchedReceipts={{
            count: overview.attention.unmatchedReceipts.count,
            amount: overview.attention.unmatchedReceipts.amount.toString(),
          }}
        />
      </div>
    </>
  );
}

// ── Received tab (basic — full version lands Phase 5) ────────────

async function ReceivedTab({
  ctx, searchParams,
}: { ctx: Awaited<ReturnType<typeof devContext>>; searchParams: SearchParams }) {
  const q    = searchParams.q?.trim();
  const page = parsePositiveInt(searchParams.page) ?? 1;
  const sort = (searchParams.sort as "recent" | "oldest" | "amount" | undefined) ?? "recent";

  const receipts = await listReceipts(ctx, { ...(q != null && { search: q }), page, sort });

  return (
    <>
      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
        All payments received {q ? `matching "${q}"` : ""}
      </div>
      <ReceiptsTable rows={receipts.rows} />
      <Pager page={page} pageSize={receipts.pageSize} total={receipts.total} />
    </>
  );
}

// ── Placeholder tabs (Phase 5 fills these in with real content) ────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="rounded-[14px] bg-surface border border-rule px-6 py-16 text-center">
      <div className="text-[14px] text-text mb-2">{title} — coming soon</div>
      <p className="text-[12px] text-text-dim max-w-md mx-auto">
        The detailed view lands in the next round. Everything you need for a fast decision is on the
        Overview tab.
      </p>
      <Link
        href={"/accounts" as Route}
        className="mt-4 inline-block text-[12px] text-accent hover:underline"
      >
        Back to Overview
      </Link>
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────

/** Map the existing 5-bucket aging into the 4 segments the spec draws:
 *  Not yet due · 0–30 late · 31–60 late · 60+ late (§7.2). */
function buildOwedSegments(
  aging: Array<{ key: string; amount: bigint }>,
): HowLongOwedSegment[] {
  const byKey = new Map(aging.map((b) => [b.key, b.amount]));
  const zero = 0n;
  const d60p =
    (byKey.get("d61_90") ?? zero) + (byKey.get("d90p") ?? zero);
  return [
    { key: "current", label: "Not yet due",  amount: (byKey.get("current") ?? zero).toString() },
    { key: "d0_30",   label: "0–30 late",    amount: (byKey.get("d1_30")   ?? zero).toString() },
    { key: "d31_60",  label: "31–60 late",   amount: (byKey.get("d31_60")  ?? zero).toString() },
    { key: "d60p",    label: "60+ late",     amount: d60p.toString() },
  ];
}

function DeltaText({
  current, previous, invert,
}: { current: bigint; previous: bigint; invert?: boolean }) {
  if (previous === 0n) {
    return <span className="text-text-dim">{current === 0n ? "Nothing recorded yet" : "vs last month: new"}</span>;
  }
  const delta = Number(current - previous);
  const pct   = (delta / Number(previous)) * 100;
  const up    = pct >= 0;
  const isFavourable = invert ? !up : up;
  const tone = pct === 0
    ? "text-text-dim"
    : isFavourable ? "text-solid" : "text-warn";
  const arrow = pct === 0 ? "—" : up ? "▲" : "▼";
  return (
    <span className={tone}>
      {arrow} {Math.abs(pct).toFixed(0)}% vs last month
    </span>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
