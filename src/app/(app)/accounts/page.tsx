import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { listReceipts } from "@/modules/receipts/queries";
import { loadAccountsOverview, type AgingBucket } from "@/modules/accounts/queries";
import { ReceiptsTable } from "./_components/ReceiptsTable";
import {
  KpiCard, AgingCell, SectionHeader,
  OutstandingTable, RecentReceiptsTable,
} from "./_components/AccountsWidgets";

export const dynamic = "force-dynamic";

const VALID_BUCKETS = ["current", "d1_30", "d31_60", "d61_90", "d90p"] as const;

interface SearchParams { q?: string; page?: string; sort?: string; bucket?: string; }

export default async function AccountsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx    = await devContext();

  const q      = params.q?.trim();
  const page   = parsePositiveInt(params.page) ?? 1;
  const sort   = (params.sort as "recent" | "oldest" | "amount" | undefined) ?? "recent";
  const bucket = VALID_BUCKETS.find((b) => b === params.bucket) as AgingBucket["key"] | undefined;

  const [overview, receipts] = await Promise.all([
    loadAccountsOverview(ctx, { bucketFilter: bucket }),
    listReceipts(ctx, { ...(q != null && { search: q }), page, sort }),
  ]);

  const hasAnyMoney = overview.invoiced > 0n || overview.received > 0n || overview.outstanding > 0n;
  const openCount   = overview.aging.reduce((s, b) => s + b.count, 0);

  return (
    <>
      <Topbar
        title="Accounts & Payments"
        eyebrow={
          hasAnyMoney
            ? `${overview.invoiceCount} invoice${overview.invoiceCount === 1 ? "" : "s"} · ${overview.paidCount} settled · ${overview.overdueCount} overdue`
            : "Record your first invoice and receipt to see the money view"
        }
        actions={
          <Link href={"/accounts/new" as Route}>
            <PrimaryButton>+ Record Receipt</PrimaryButton>
          </Link>
        }
      />

      {/* 5-card KPI strip */}
      <section className="grid grid-cols-2 xl:grid-cols-5 gap-3 md:gap-4 mb-6">
        <KpiCard label="Invoiced"        value={formatINR(overview.invoiced)}        tone="neutral" />
        <KpiCard label="Received"        value={formatINR(overview.received)}        tone="good" />
        <KpiCard label="Outstanding"     value={formatINR(overview.outstanding)}     tone="warn" />
        <KpiCard label="Overdue"         value={formatINR(overview.overdue)}         tone="bad" />
        <KpiCard
          label="Customer Credit"
          value={formatINR(overview.customerCredit)}
          tone="accent"
          hint={overview.customerCredit > 0n ? "Unallocated receipts" : undefined}
        />
      </section>

      {/* Aging + Who Owes Most */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
        <div className="lg:col-span-3 rounded-[14px] bg-surface border border-rule overflow-hidden">
          <SectionHeader
            title="Aging of receivables"
            note={
              overview.outstanding > 0n
                ? `${formatINR(overview.outstanding)} across ${openCount} invoice${openCount === 1 ? "" : "s"}`
                : "No outstanding balance"
            }
            action={
              bucket && (
                <Link href={"/accounts" as Route} className="text-[11px] text-accent hover:underline ml-2">
                  Clear filter ×
                </Link>
              )
            }
          />
          <div className="grid grid-cols-5 divide-x divide-rule border-b border-rule">
            {overview.aging.map((b) => (
              <AgingCell key={b.key} bucket={b} activeBucket={overview.activeBucket} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-[14px] bg-surface border border-rule overflow-hidden h-fit">
          <SectionHeader
            title="Who owes most"
            note={overview.topClients.length ? `${overview.topClients.length} client${overview.topClients.length === 1 ? "" : "s"}` : undefined}
          />
          {overview.topClients.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-text-faint">Everyone is square.</div>
          ) : (
            <ul className="divide-y divide-rule/60">
              {overview.topClients.map((c) => (
                <li key={c.clientId} className="px-4 py-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/clients/${c.clientId}` as Route} className="text-[12.5px] text-text hover:text-accent truncate block">
                      {c.clientName}
                    </Link>
                    <div className="text-[10.5px] text-text-dim tabular flex items-center gap-2">
                      <span>{c.invoiceCount} invoice{c.invoiceCount === 1 ? "" : "s"}</span>
                      {c.oldestDays > 0 && <span>· oldest +{c.oldestDays}d</span>}
                      <Link href={`/accounts/new?clientId=${c.clientId}` as Route} className="text-accent hover:underline ml-1">
                        Record payment →
                      </Link>
                    </div>
                  </div>
                  <div className="tabular text-text font-medium whitespace-nowrap">{formatINR(c.outstanding)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Outstanding invoices */}
      <section className="mb-6 rounded-[14px] bg-surface border border-rule overflow-hidden">
        <SectionHeader
          title={bucket ? `Outstanding — ${overview.aging.find((b) => b.key === bucket)?.label ?? bucket}` : "Outstanding invoices"}
          note={overview.outstandingInvoices.length > 0
            ? `${overview.outstandingInvoices.length} invoice${overview.outstandingInvoices.length === 1 ? "" : "s"}${overview.outstandingInvoices.length >= 50 ? " (top 50)" : ""}`
            : undefined}
        />
        {overview.outstandingInvoices.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-text-faint">
            {bucket ? "No invoices in this aging bucket." : "No outstanding invoices. Every issued bill is settled."}
          </div>
        ) : (
          <OutstandingTable rows={overview.outstandingInvoices} />
        )}
      </section>

      {/* Recent receipts */}
      <section className="mb-6 rounded-[14px] bg-surface border border-rule overflow-hidden">
        <SectionHeader
          title="Recent receipts"
          note={overview.recentReceipts.length ? "Last 8 payments received" : undefined}
          action={
            overview.recentReceipts.length > 0
              ? <Link href={"#all-receipts" as Route} className="text-[11px] text-accent hover:underline">View all</Link>
              : undefined
          }
        />
        {overview.recentReceipts.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-text-faint">
            No receipts yet.{" "}
            <Link href={"/accounts/new" as Route} className="text-accent hover:underline">Record the first one</Link>.
          </div>
        ) : (
          <RecentReceiptsTable rows={overview.recentReceipts} />
        )}
      </section>

      {/* All receipts (paginated) */}
      <div id="all-receipts" className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
        All receipts {q ? `matching "${q}"` : ""}
      </div>
      <ReceiptsTable rows={receipts.rows} />
      <Pager page={page} pageSize={receipts.pageSize} total={receipts.total} />
    </>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}
