import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { loadDashboard } from "@/modules/dashboard/queries";
import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { KpiCard } from "./_dashboard/KpiCard";
import { RevenueChart } from "./_dashboard/RevenueChart";
import { ProjectStages } from "./_dashboard/ProjectStages";
import { SiteVisits } from "./_dashboard/SiteVisits";
import { RecentActivity } from "./_dashboard/RecentActivity";

export const dynamic = "force-dynamic";

// Owner Dashboard. Composition only — data comes from the dashboard
// repository (src/modules/dashboard/queries.ts) via db.scoped(ctx). Every
// numeric section lives in its own file under _dashboard/ so nothing here
// crosses the 300-line rule.

export default async function DashboardPage() {
  const ctx = await devContext();
  const d = await loadDashboard(ctx);

  const trendTone = d.revenueMtdTrendPct >= 0 ? "good" : "bad";
  const trendSign = d.revenueMtdTrendPct >= 0 ? "+" : "";

  return (
    <>
      <Topbar
        title="Dashboard"
        eyebrow={`Studio at a glance · ${todayEyebrow()}`}
        actions={<PrimaryButton>New Quote</PrimaryButton>}
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
