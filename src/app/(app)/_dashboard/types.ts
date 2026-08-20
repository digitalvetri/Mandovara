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
  meta: string;       // "Measurement · 10:30 AM"
  assignee: string;   // team member's name
  status: string;
  isOverdue: boolean; // past scheduledAt, still SCHEDULED
}

export type ActivityKind = "quote" | "payment" | "lead";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  when: string;
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

  revenueByMonth: RevenueMonth[];
  projectStages: ProjectStage[];
  siteVisits: SiteVisit[];
  activity: ActivityItem[];
}
