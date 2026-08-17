import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { Pager } from "@/components/data/Pager";
import { devContext } from "@/lib/dev-context";
import { listReceipts } from "@/modules/receipts/queries";
import { loadAccountsOverview } from "@/modules/accounts/queries";
import { ReceiptsTable } from "./_components/ReceiptsTable";
import {
  Headline, SectionCard, MoneyOwedList, RecentPaymentsList,
  MoneyOwedEmpty, RecentPaymentsEmpty,
} from "./_components/AccountsWidgets";
import { PaymentModeChart, type ModeSlice } from "./_components/PaymentModeChart";

export const dynamic = "force-dynamic";

interface SearchParams { q?: string; page?: string; sort?: string; }

export default async function AccountsPage({
  searchParams,
}: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const ctx    = await devContext();

  const q    = params.q?.trim();
  const page = parsePositiveInt(params.page) ?? 1;
  const sort = (params.sort as "recent" | "oldest" | "amount" | undefined) ?? "recent";

  const [overview, receipts] = await Promise.all([
    loadAccountsOverview(ctx, {}),
    listReceipts(ctx, { ...(q != null && { search: q }), page, sort }),
  ]);

  const owedClientCount = overview.topClients.length;
  const hasOwed         = overview.outstanding > 0n;

  // BigInt can't cross the RSC → client component boundary — stringify amounts.
  const modeSlices: ModeSlice[] = overview.paymentModes.map((m) => ({
    mode:   m.mode,
    amount: m.amount.toString(),
    count:  m.count,
  }));

  return (
    <>
      <Topbar
        title="Accounts & Payments"
        eyebrow="Track money owed to you and record payments received"
        actions={
          <Link href={"/accounts/new" as Route}>
            <PrimaryButton>+ Record Payment</PrimaryButton>
          </Link>
        }
      />

      {/* Headline: one big number, plain English */}
      <Headline
        owed={overview.outstanding}
        overdue={overview.overdue}
        clientCount={owedClientCount}
      />

      {/* Payment-mode donut */}
      <section className="mb-6 rounded-[14px] bg-surface border border-rule p-5 md:p-6">
        <PaymentModeChart slices={modeSlices} />
      </section>

      {/* Two-column body: Money owed | Recent payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        <SectionCard
          title="Money owed to you"
          note={hasOwed ? `${owedClientCount} client${owedClientCount === 1 ? "" : "s"}` : undefined}
        >
          {overview.topClients.length === 0
            ? <MoneyOwedEmpty />
            : <MoneyOwedList rows={overview.topClients} />}
        </SectionCard>

        <SectionCard
          title="Recent payments"
          note={overview.recentReceipts.length > 0 ? "Last 8 received" : undefined}
        >
          {overview.recentReceipts.length === 0
            ? <RecentPaymentsEmpty />
            : <RecentPaymentsList rows={overview.recentReceipts} />}
        </SectionCard>

      </div>

      {/* Full receipt log — kept for accounts / audit view */}
      <div id="all-receipts" className="mb-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
        All payments {q ? `matching "${q}"` : ""}
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
