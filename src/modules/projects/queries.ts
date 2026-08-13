// Projects repository.
// Schema: Project has `stage ProjectStage`, `siteAddress Json`, `orderValue BigInt`.
// No status, startDate, targetEndDate, milestones, tasks, or siteLogs fields.
// Client relation exists via clientId; Branch via branchId.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListProjectsQuery {
  search?: string;
  stage?: string | "ACTIVE" | "ALL";
  page?: number;
  pageSize?: number;
}

export interface ProjectRow {
  id: string;
  number: string;
  name: string;
  clientId: string;
  clientName: string;
  stage: string;
  orderValue: bigint;
  expectedInstallAt: Date | null;
  createdAt: Date;
}

export interface ListProjectsResult {
  rows: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProjectDetail {
  id: string;
  number: string;
  name: string;
  stage: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  branchId: string;
  ownerId: string;
  siteAddress: Record<string, unknown> | null;
  siteContactName: string | null;
  siteContactMobile: string | null;
  expectedInstallAt: Date | null;
  orderValue: bigint;
  createdAt: Date;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Active stages — post-enquiry, real work underway
const ACTIVE_STAGES = [
  "ORDERED", "PROCUREMENT", "MAKE", "INSTALLATION", "SNAGGING",
] as const;

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
  if (q.stage && q.stage !== "ALL") {
    if (q.stage === "ACTIVE") where["stage"] = { in: [...ACTIVE_STAGES] };
    else where["stage"] = q.stage;
  }

  const [rows, total] = await Promise.all([
    db.project.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: pageSize,
      select: {
        id: true, number: true, name: true, stage: true,
        orderValue: true, expectedInstallAt: true, createdAt: true,
        client: { select: { id: true, name: true } },
      },
    }),
    db.project.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id, number: r.number, name: r.name, stage: r.stage,
      clientId: r.client.id, clientName: r.client.name,
      orderValue: r.orderValue,
      expectedInstallAt: r.expectedInstallAt,
      createdAt: r.createdAt,
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
      id: true, number: true, name: true, stage: true, branchId: true, ownerId: true,
      siteAddress: true, siteContactName: true, siteContactMobile: true,
      expectedInstallAt: true, orderValue: true, createdAt: true,
      client: { select: { id: true, name: true, mobile: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id, number: row.number, name: row.name, stage: row.stage,
    clientId: row.client.id, clientName: row.client.name, clientMobile: row.client.mobile,
    branchId: row.branchId, ownerId: row.ownerId,
    siteAddress: row.siteAddress as Record<string, unknown> | null,
    siteContactName: row.siteContactName,
    siteContactMobile: row.siteContactMobile,
    expectedInstallAt: row.expectedInstallAt,
    orderValue: row.orderValue,
    createdAt: row.createdAt,
  };
}

export type ProjectMilestone = {
  id: string;
  name: string;
  order: number;
  plannedDate: Date;
  actualDate: Date | null;
  billingPct: string;
  status: string;
};

export type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
};

export type ProjectSiteLog = {
  id: string;
  loggedAt: Date;
  summary: string;
  weather: string | null;
  manpowerCount: number | null;
};

export async function getProjectMilestones(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectMilestone[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const rows = await db.milestone.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: {
      id: true, name: true, order: true, plannedDate: true,
      actualDate: true, billingPct: true, status: true,
    },
  });
  return rows.map((r) => ({ ...r, billingPct: r.billingPct.toString() }));
}

export async function getProjectTasks(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectTask[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const rows = await db.task.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
    select: {
      id: true, title: true, description: true,
      status: true, priority: true, dueAt: true, completedAt: true,
    },
  });
  return rows.map((r) => ({ ...r, dueDate: r.dueAt }));
}

export async function getProjectSiteLogs(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectSiteLog[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  return db.siteLog.findMany({
    where: { projectId },
    orderBy: { loggedAt: "desc" },
    select: {
      id: true, loggedAt: true, summary: true, weather: true, manpowerCount: true,
    },
  });
}

export interface ClientPickerRow {
  id: string; name: string; mobile: string;
}

export async function listClientsForProject(ctx: RequestContext): Promise<ClientPickerRow[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const rows = await db.client.findMany({
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, mobile: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, mobile: r.mobile }));
}
