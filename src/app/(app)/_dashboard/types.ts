// Dashboard view-model types. Shared by the queries repository
// (src/modules/dashboard/queries.ts) and the presentation components.

import type { Paise } from "@/kernel/money/paise";

export interface RevenueMonth {
  label: string;
  lakhs: number; // display value, one decimal
}

export interface ProjectStage {
  name: string;
  count: number;
}

export interface SiteVisit {
  id: string;
  day: string;
  month: string;
  name: string;
  meta: string; // "Measurement · 10:30 AM"
  owner: string;
}

export type ActivityKind = "quote" | "payment" | "lead";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  when: string;
}

// Phase 8b — operational KPIs pulled from the newer modules.
// Live counts of work in flight so the owner sees today's studio
// state without navigating out.
export interface OperationsKpi {
  // Make (§5.2 / Phase 5b) — open kanban work.
  makeInProgressCount: number;
  makeQueuedCount:     number;
  makeReadyCount:      number;

  // Install (§5.2 / Phase 5c) — visits scheduled or in-progress
  // in the next 7 days.
  installVisitsThisWeek: number;

  // Architect commissions (Phase 6b) — sum of unpaid, non-cancelled.
  commissionsOutstanding: Paise;
  commissionsCount:       number;

  // Payroll (Phase 7a) — most recent run and its status.
  latestPayrollPeriod?:  string;      // "Jul 2026"
  latestPayrollTotal?:   Paise;
  latestPayrollStatus?:  string;
  latestPayrollRunId?:   string;
}

export interface DashboardData {
  revenueMtd: Paise;
  revenueMtdPrev: Paise;
  revenueMtdTrendPct: number;

  activeProjects: number;
  activeProjectsDelta: number;
  activeProjectsHandover: number;

  openLeads: number;
  openLeadsDelta: number;
  openLeadsAwaitingQuote: number;

  overdueInvoices: Paise;
  overdueInvoicesCount: number;
  overdueBadge: number;

  operations: OperationsKpi;

  revenueByMonth: RevenueMonth[];
  projectStages: ProjectStage[];
  siteVisits: SiteVisit[];
  activity: ActivityItem[];
}
