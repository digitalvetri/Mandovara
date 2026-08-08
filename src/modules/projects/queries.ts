// Projects repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { ProjectStatus } from "./schema";

export interface ListProjectsQuery {
  search?: string;
  status?: ProjectStatus | "OPEN" | "ALL";
  page?: number;
  pageSize?: number;
}

export interface ProjectRow {
  id: string;
  number: string;
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  startDate: Date;
  targetEndDate: Date | null;
  orderValue: bigint;
  milestoneCount: number;
  completedMilestones: number;
}

export interface ListProjectsResult {
  rows: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectMilestone {
  id: string;
  name: string;
  order: number;
  plannedDate: Date;
  actualDate: Date | null;
  billingPct: string;
  status: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
}

export interface ProjectSiteLog {
  id: string;
  loggedAt: Date;
  summary: string;
  weather: string | null;
  manpowerCount: number | null;
}

export interface ProjectSnag {
  id: string;
  location: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectExpenseRow {
  id: string;
  category: string;
  amount: bigint;
  description: string | null;
  spentAt: Date;
  status: string;
}

export interface ProjectHandover {
  handedOverAt: Date;
  checklist: Record<string, { checked: boolean; note?: string }>;
}

export interface ProjectDetail {
  id: string;
  number: string;
  name: string;
  status: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  branchId: string;
  branchName: string;
  startDate: Date;
  targetEndDate: Date | null;
  actualEndDate: Date | null;
  orderValue: bigint;
  budgetMaterial: bigint;
  budgetLabour: bigint;
  createdAt: Date;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  siteLogs: ProjectSiteLog[];
  snags: ProjectSnag[];
  expenses: ProjectExpenseRow[];
  handover: ProjectHandover | null;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listProjects(
  ctx: RequestContext,
  q: ListProjectsQuery,
): Promise<ListProjectsResult> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:   { contains: s, mode: "insensitive" } },
      { number: { contains: s, mode: "insensitive" } },
      { client: { name: { contains: s, mode: "insensitive" } } },
    ];
  }
  if (q.status && q.status !== "ALL") {
    if (q.status === "OPEN") where["status"] = { in: ["PLANNING", "ACTIVE"] };
    else where["status"] = q.status;
  }

  const [rows, total] = await Promise.all([
    db.project.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: pageSize,
      select: {
        id: true, number: true, name: true, status: true,
        startDate: true, targetEndDate: true, orderValue: true,
        client: { select: { id: true, name: true } },
        milestones: { select: { status: true } },
      },
    }),
    db.project.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id, number: r.number, name: r.name, status: r.status,
      clientId: r.client.id, clientName: r.client.name,
      startDate: r.startDate, targetEndDate: r.targetEndDate,
      orderValue: r.orderValue,
      milestoneCount: r.milestones.length,
      completedMilestones: r.milestones.filter((m) => m.status === "COMPLETED").length,
    })),
    total, page, pageSize,
  };
}

export async function getProject(ctx: RequestContext, id: string): Promise<ProjectDetail | null> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const row = await db.project.findUnique({
    where: { id },
    select: {
      id: true, number: true, name: true, status: true, branchId: true,
      startDate: true, targetEndDate: true, actualEndDate: true,
      orderValue: true, budgetMaterial: true, budgetLabour: true, createdAt: true,
      client: { select: { id: true, name: true, primaryMobile: true } },
      milestones: {
        orderBy: { order: "asc" },
        select: {
          id: true, name: true, order: true, plannedDate: true, actualDate: true,
          billingPct: true, status: true,
        },
      },
      tasks: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        select: {
          id: true, title: true, description: true, status: true,
          priority: true, dueDate: true, completedAt: true,
        },
      },
      siteLogs: {
        orderBy: { loggedAt: "desc" },
        take: 30,
        select: {
          id: true, loggedAt: true, summary: true, weather: true, manpowerCount: true,
        },
      },
      snags: {
        // OPEN first (asc: OPEN < IN_PROGRESS < RESOLVED < VERIFIED), then newest first.
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        select: {
          id: true, location: true, description: true, status: true,
          createdAt: true, updatedAt: true,
        },
      },
      expenses: {
        orderBy: { spentAt: "desc" },
        take: 60,
        select: {
          id: true, category: true, amount: true, description: true,
          spentAt: true, status: true,
        },
      },
      handover: {
        select: { handedOverAt: true, checklist: true },
      },
    },
  });
  if (!row) return null;
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: row.branchId }, select: { name: true },
  });

  return {
    id: row.id, number: row.number, name: row.name, status: row.status,
    clientId: row.client.id, clientName: row.client.name, clientMobile: row.client.primaryMobile,
    branchId: row.branchId, branchName: branch.name,
    startDate: row.startDate, targetEndDate: row.targetEndDate, actualEndDate: row.actualEndDate,
    orderValue: row.orderValue, budgetMaterial: row.budgetMaterial, budgetLabour: row.budgetLabour,
    createdAt: row.createdAt,
    milestones: row.milestones.map((m) => ({
      id: m.id, name: m.name, order: m.order,
      plannedDate: m.plannedDate, actualDate: m.actualDate,
      billingPct: m.billingPct.toString(), status: m.status,
    })),
    tasks: row.tasks.map((t) => ({
      id: t.id, title: t.title, description: t.description,
      status: t.status, priority: t.priority,
      dueDate: t.dueDate, completedAt: t.completedAt,
    })),
    siteLogs: row.siteLogs.map((s) => ({
      id: s.id, loggedAt: s.loggedAt, summary: s.summary,
      weather: s.weather, manpowerCount: s.manpowerCount,
    })),
    snags: row.snags.map((s) => ({
      id: s.id, location: s.location, description: s.description,
      status: s.status, createdAt: s.createdAt, updatedAt: s.updatedAt,
    })),
    expenses: row.expenses.map((e) => ({
      id: e.id, category: e.category, amount: e.amount,
      description: e.description, spentAt: e.spentAt, status: e.status,
    })),
    handover: row.handover
      ? {
          handedOverAt: row.handover.handedOverAt,
          checklist: (row.handover.checklist ?? {}) as Record<
            string,
            { checked: boolean; note?: string }
          >,
        }
      : null,
  };
}

export interface ClientPickerRow {
  id: string; name: string; mobile: string;
}
export async function listClientsForProject(ctx: RequestContext): Promise<ClientPickerRow[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const rows = await db.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, primaryMobile: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, mobile: r.primaryMobile }));
}
