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
import {
  InOutStrip, SectionCard,
  MoneyOwedList, RecentPaymentsList, RecentOutflowsList,
  MoneyOwedEmpty, RecentPaymentsEmpty, RecentOutflowsEmpty,
} from "./_components/AccountsWidgets";
import { PaymentModeChart, type ModeSlice } from "./_components/PaymentModeChart";
import { OutflowChart, type OutflowSlice } from "./_components/OutflowChart";
import { KpiCard } from "./_components/KpiCard";
import { ChaseList, type ChaseRowUI } from "./_components/ChaseList";
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
      {activeTab === "overview"    ? <OverviewTab ctx={ctx} searchParams={params} /> : null}
      {activeTab === "to-collect"  ? <ComingSoon title="To Collect" /> : null}
      {activeTab === "received"    ? <ComingSoon title="Received"   /> : null}
      {activeTab === "to-pay"      ? <ComingSoon title="To Pay"     /> : null}
      {activeTab === "spending"    ? <ComingSoon title="Spending"   /> : null}
    </>
  );
}

// ── Overview tab (the redesigned page body) ───────────────────────

async function OverviewTab({
  ctx, searchParams,
}: { ctx: Awaited<ReturnType<typeof devContext>>; searchParams: SearchParams }) {
  const q    = searchParams.q?.trim();
  const page = parsePositiveInt(searchParams.page) ?? 1;
  const sort = (searchParams.sort as "recent" | "oldest" | "amount" | undefined) ?? "recent";

  const [overview, receipts, chase, org] = await Promise.all([
    loadAccountsOverview(ctx, {}),
    listReceipts(ctx, { ...(q != null && { search: q }), page, sort }),
    loadChaseList(ctx, { take: 5 }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
  ]);

  const kpis = overview.moneyKpis;
  const orgName = org?.name ?? "Mandovara";

  // Chase rows: stringify BigInt + dates before crossing the RSC boundary
  const chaseRows: ChaseRowUI[] = chase.map((c) => ({
    clientId:              c.clientId,
    clientName:            c.clientName,
    clientMobile:          c.clientMobile,
    outstanding:           c.outstanding.toString(),
    oldestLateDays:        c.oldestLateDays,
    lastContactedDaysAgo:  c.lastContactedDaysAgo,
    activePromiseDate:     c.activePromiseDate ? c.activePromiseDate.toISOString() : null,
  }));

  const showMoneyOut = !overview.moneyOut.hidden;

  const modeSlices: ModeSlice[] = overview.paymentModes.map((m) => ({
    mode: m.mode, amount: m.amount.toString(), count: m.count,
  }));
  const outflowSlices: OutflowSlice[] = overview.outflowKinds.map((k) => ({
    kind: k.kind, label: k.label, amount: k.amount.toString(), count: k.count,
  }));

  return (
    <>
      {/* 4 KPI cards — §5.3. On phone the first is hero-full-width; the other three sit in a 2×2 grid. */}
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

      {/* Everything below is Phase-2 hold-over — charts + widgets get
          rebuilt in Phase 4. Keeping them here for now so the page stays
          useful during the rebuild. */}
      {showMoneyOut && (
        <InOutStrip moneyIn={overview.moneyOut.moneyIn} moneyOut={overview.moneyOut.total} />
      )}

      <div className={`grid grid-cols-1 ${showMoneyOut ? "lg:grid-cols-2" : ""} gap-4 mb-6`}>
        <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
          <PaymentModeChart slices={modeSlices} />
        </section>
        {showMoneyOut && (
          <section className="rounded-[14px] bg-surface border border-rule p-5 md:p-6">
            <OutflowChart slices={outflowSlices} />
          </section>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionCard
          title="Money owed to you"
          note={overview.topClients.length > 0 ? `${overview.topClients.length} client${overview.topClients.length === 1 ? "" : "s"}` : undefined}
        >
          {overview.topClients.length === 0
            ? <MoneyOwedEmpty />
            : <MoneyOwedList rows={overview.topClients} />}
        </SectionCard>
        <SectionCard
          title="Recent payments received"
          note={overview.recentReceipts.length > 0 ? "Last 8" : undefined}
        >
          {overview.recentReceipts.length === 0
            ? <RecentPaymentsEmpty />
            : <RecentPaymentsList rows={overview.recentReceipts} />}
        </SectionCard>
      </div>

      {showMoneyOut && (
        <div className="mb-6">
          <SectionCard
            title="Recent expenses & salary"
            note={overview.recentOutflows.length > 0 ? "Last 8" : undefined}
          >
            {overview.recentOutflows.length === 0
              ? <RecentOutflowsEmpty />
              : <RecentOutflowsList rows={overview.recentOutflows} />}
          </SectionCard>
        </div>
      )}

      <div id="all-receipts" className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
        All payments {q ? `matching "${q}"` : ""}
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
        The detail tabs land in the next round. For now, everything you need is on the Overview tab.
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

function DeltaText({
  current, previous, invert,
}: { current: bigint; previous: bigint; invert?: boolean }) {
  if (previous === 0n) {
    return <span className="text-text-dim">{current === 0n ? "Nothing recorded yet" : "vs last month: new"}</span>;
  }
  // pct delta with a sign
  const delta = Number(current - previous);
  const pct   = (delta / Number(previous)) * 100;
  const up    = pct >= 0;
  // For "Came in", up is good (green). For "Spent", up is bad (invert=true) — red.
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
