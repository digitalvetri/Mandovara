import { redirect } from "next/navigation";
import { formatINR } from "@/kernel/money/format";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";
import { loadDashboard } from "@/modules/dashboard/queries";
import { loadDaySummary } from "@/modules/dashboard/day-summary";
import type { DashboardData } from "./_dashboard/types";
import type { RequestContext } from "@/kernel/auth/context";

import { PrimaryButton, Topbar } from "@/components/layout/Topbar";
import { DaySummary } from "./_dashboard/DaySummary";
import { IST_TIMEZONE } from "@/kernel/datetime";
import { KpiCard } from "./_dashboard/KpiCard";
import { RevenueChart } from "./_dashboard/RevenueChart";
import { ProjectStages } from "./_dashboard/ProjectStages";
import { SiteVisits } from "./_dashboard/SiteVisits";
import { RecentActivity } from "./_dashboard/RecentActivity";

export const dynamic = "force-dynamic";

const STUB_DASHBOARD: DashboardData = {
  revenueMtd: 0n, revenueMtdPrev: 0n, revenueMtdTrendPct: 0,
  activeProjects: 0, activeProjectsDelta: 0, activeProjectsHandover: 0,
  openLeads: 0, openLeadsDelta: 0, openLeadsAwaitingQuote: 0,
  overdueInvoices: 0n, overdueInvoicesCount: 0, overdueBadge: 0,
  revenueByMonth: [], projectStages: [], siteVisits: [], activity: [],
};

async function getUserName(ctx: RequestContext): Promise<string> {
  try {
    const user = await scoped(ctx).user.findUnique({
      where:  { id: ctx.userId },
      select: { name: true },
    });
    return user?.name ?? "there";
  } catch {
    return "there";
  }
}

async function safeLoadDaySummary(ctx: RequestContext) {
  try {
    return await loadDaySummary(ctx);
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const ctx  = await devContext();
  const role = ctx.roles[0] ?? "OWNER";

  // All non-owner roles use the employee dashboard (/employee).
  // This prevents crashing on role-specific views and keeps one consistent
  // employee experience.
  if (role !== "OWNER") {
    redirect("/employee");
  }

  const [userName, daySummary] = await Promise.all([
    getUserName(ctx),
    safeLoadDaySummary(ctx),
  ]);

  const istNow = new Date();
  const istHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: IST_TIMEZONE, hour: "2-digit", hour12: false,
    }).format(istNow),
  );
  const istDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TIMEZONE, weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(istNow);

  const greeting = (
    <DaySummary
      items={daySummary}
      userName={userName}
      hour={istHour}
      dateLabel={istDate}
    />
  );

  // OWNER — full cockpit
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
        eyebrow="studio at a glance"
        actions={<PrimaryButton href="/quotations/quick">New Quote</PrimaryButton>}
        showSchedule
      />

      {greeting}

      <section className="stagger mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          featured
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

      <section className="rise mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ "--d": "150ms" } as React.CSSProperties}>
        <div className="lg:col-span-2">
          <RevenueChart months={d.revenueByMonth} />
        </div>
        <ProjectStages stages={d.projectStages} />
      </section>

      <section className="rise mt-4 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ "--d": "210ms" } as React.CSSProperties}>
        <SiteVisits visits={d.siteVisits} />
        <RecentActivity items={d.activity} />
      </section>


    </>
  );
}

function formatLakhs(p: bigint): string {
  const rupees = Number(p / 100n);
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(1)}Cr`;
  if (rupees >= 100_000)    return `₹${(rupees / 100_000).toFixed(1)}L`;
  return formatINR(p);
}
