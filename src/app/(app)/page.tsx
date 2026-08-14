import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { loadDashboard } from "@/modules/dashboard/queries";
import type { DashboardData } from "./_dashboard/types";

const STUB_DASHBOARD: DashboardData = {
  revenueMtd: 0n, revenueMtdPrev: 0n, revenueMtdTrendPct: 0,
  activeProjects: 0, activeProjectsDelta: 0, activeProjectsHandover: 0,
  openLeads: 0, openLeadsDelta: 0, openLeadsAwaitingQuote: 0,
  overdueInvoices: 0n, overdueInvoicesCount: 0, overdueBadge: 0,
  revenueByMonth: [], projectStages: [], siteVisits: [], activity: [],
};
import Link from "next/link";
import type { Route } from "next";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "./_dashboard/KpiCard";
import { RevenueChart } from "./_dashboard/RevenueChart";
import { ProjectStages } from "./_dashboard/ProjectStages";
import { SiteVisits } from "./_dashboard/SiteVisits";
import { RecentActivity } from "./_dashboard/RecentActivity";
import { SalesView } from "./_dashboard/SalesView";
import { MeasureExecView } from "./_dashboard/MeasureExecView";
import { StoreView } from "./_dashboard/StoreView";
import { MakeSupervisorView } from "./_dashboard/MakeSupervisorView";
import { InstallerView } from "./_dashboard/InstallerView";
import { AccountsView } from "./_dashboard/AccountsView";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx  = await devContext();
  const role = ctx.roles[0] ?? "OWNER";

  // Role-specific landing — each role sees the data most relevant to their job
  if (role === "SALES" || role === "DESIGNER") {
    return (
      <>
        <Topbar title="My Dashboard" eyebrow={`${role.toLowerCase()} · ${todayEyebrow()}`} />
        <SalesView ctx={ctx} />
      </>
    );
  }
  if (role === "MEASURE_EXEC") {
    return (
      <>
        <Topbar title="Measurement Schedule" eyebrow={`${todayEyebrow()}`} />
        <MeasureExecView ctx={ctx} />
      </>
    );
  }
  if (role === "STORE") {
    return (
      <>
        <Topbar title="Store Dashboard" eyebrow={`${todayEyebrow()}`} />
        <StoreView ctx={ctx} />
      </>
    );
  }
  if (role === "MAKE_SUPERVISOR") {
    return (
      <>
        <Topbar title="Production Dashboard" eyebrow={`${todayEyebrow()}`} />
        <MakeSupervisorView ctx={ctx} />
      </>
    );
  }
  if (role === "INSTALLER") {
    return (
      <>
        <Topbar title="Install Route" eyebrow={`${todayEyebrow()}`} />
        <InstallerView ctx={ctx} />
      </>
    );
  }
  if (role === "ACCOUNTS") {
    return (
      <>
        <Topbar title="Accounts Dashboard" eyebrow={`${todayEyebrow()}`} />
        <AccountsView ctx={ctx} />
      </>
    );
  }

  // OWNER / HR / fallback → full cockpit view
  let d: DashboardData;
  try {
    d = await loadDashboard(ctx);
  } catch {
    d = STUB_DASHBOARD;
  }

  const trendTone = d.revenueMtdTrendPct >= 0 ? "good" : "bad";
  const trendSign = d.revenueMtdTrendPct >= 0 ? "+" : "";

  return (
    <>
      <Topbar
        title="Dashboard"
        eyebrow={`Studio at a glance · ${todayEyebrow()}`}
        actions={
          <Link href={"/quotations/quick" as Route}>
            <PrimaryButton>New Quote</PrimaryButton>
          </Link>
        }
        showSchedule
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          label="Revenue (MTD)"
          value={formatLakhs(d.revenueMtd)}
          subtitle={`vs ${formatLakhs(d.revenueMtdPrev)} last month`}
          trend={`${trendSign}${d.revenueMtdTrendPct}%`}
          trendTone={trendTone}
        />
        <KpiCard
          label="Active Projects"
          value={String(d.activeProjects)}
          subtitle={`${d.activeProjectsHandover} nearing handover`}
          trend={`+${d.activeProjectsDelta}`}
          trendTone="good"
        />
        <KpiCard
          label="Open Leads"
          value={String(d.openLeads)}
          subtitle={`${d.openLeadsAwaitingQuote} awaiting quote`}
          trend={`+${d.openLeadsDelta}`}
          trendTone="good"
        />
        <KpiCard
          label="Overdue Invoices"
          value={formatLakhs(d.overdueInvoices)}
          subtitle={`${d.overdueInvoicesCount} invoices past due`}
          trend={String(d.overdueBadge)}
          trendTone="bad"
        />
      </section>

      <section className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart months={d.revenueByMonth} />
        </div>
        <ProjectStages stages={d.projectStages} />
      </section>

      <section className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
        <SiteVisits visits={d.siteVisits} />
        <RecentActivity items={d.activity} />
      </section>
    </>
  );
}

// Convert paise into a "₹18.4L" style short form used across the KPI row.
// The full formatINR() remains the authority for money display everywhere else.
function formatLakhs(p: bigint): string {
  const rupees = Number(p / 100n);
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)}L`;
  return formatINR(p);
}

function todayEyebrow(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });
}
