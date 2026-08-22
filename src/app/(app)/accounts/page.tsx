import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { devContext } from "@/lib/dev-context";
import { Tabs, type TabDef } from "@/components/ui/Tabs";
import { OverviewTab }   from "./_tabs/OverviewTab";
import { ToCollectTab }  from "./_tabs/ToCollectTab";
import { ReceivedTab }   from "./_tabs/ReceivedTab";
import { ToPayTab }      from "./_tabs/ToPayTab";
import { SpendingTab }   from "./_tabs/SpendingTab";
import { GstTab }        from "./_tabs/GstTab";
import type { SpendingPeriod } from "@/modules/accounts/spending";

export const dynamic = "force-dynamic";

const TABS: readonly TabDef[] = [
  { key: "overview",    label: "Overview" },
  { key: "to-collect",  label: "To Collect" },
  { key: "received",    label: "Received" },
  { key: "to-pay",      label: "To Pay" },
  { key: "spending",    label: "Expenses" },
  { key: "gst",         label: "GST" },
];

const SPENDING_PERIODS: readonly SpendingPeriod[] = ["this-month", "last-3-months", "this-year"];

interface SearchParams {
  tab?: string;
  // Received
  q?: string; page?: string; sort?: string;
  mode?: string; status?: string; unmatched?: string; month?: string;
  // To Collect
  bucket?: string;
  // Spending
  period?: string; head?: string;
  // GST
  year?: string; gstMonth?: string;
}

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
        actions={<PrimaryButton href="/accounts/new">Record Payment</PrimaryButton>}
      />
      <Tabs tabs={TABS} className="mb-6" />

      {activeTab === "overview"   ? <OverviewTab ctx={ctx} /> : null}
      {activeTab === "to-collect" ? <ToCollectTab ctx={ctx} bucket={params.bucket} /> : null}
      {activeTab === "received"   ? (
        <ReceivedTab
          ctx={ctx}
          page={parsePositiveInt(params.page) ?? 1}
          sort={(params.sort as "recent" | "oldest" | "amount") ?? "recent"}
          {...(params.q?.trim() && { q: params.q.trim() })}
          {...(params.mode        && { mode: params.mode })}
          {...(params.status      && { chequeStatus: params.status })}
          {...(params.unmatched   && { unmatched: params.unmatched === "1" })}
          {...(params.month       && { month: params.month })}
        />
      ) : null}
      {activeTab === "to-pay"     ? <ToPayTab ctx={ctx} /> : null}
      {activeTab === "spending"   ? (
        <SpendingTab
          ctx={ctx}
          period={pickPeriod(params.period)}
          {...(params.head && { head: params.head })}
        />
      ) : null}
      {activeTab === "gst" ? (
        <GstTab
          ctx={ctx}
          year={pickGstYear(params.year)}
          month={pickGstMonth(params.gstMonth)}
        />
      ) : null}
    </>
  );
}

function parsePositiveInt(v: string | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function pickPeriod(v: string | undefined): SpendingPeriod {
  return SPENDING_PERIODS.includes(v as SpendingPeriod) ? (v as SpendingPeriod) : "this-month";
}

function pickGstYear(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 2020 && n <= 2099 ? Math.floor(n) : new Date().getFullYear();
}

function pickGstMonth(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? Math.floor(n) : new Date().getMonth() + 1;
}
