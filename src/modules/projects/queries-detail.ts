// Project detail read models — milestones, tasks and site logs.

// Projects repository.
// Schema: Project has `stage ProjectStage`, `siteAddress Json`, `orderValue BigInt`.
// No status, startDate, targetEndDate, milestones, tasks, or siteLogs fields.
// Client relation exists via clientId; Branch via branchId.

import { scoped } from "@/kernel/db/scoped";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export type ProjectMilestone = {
  id: string;
  name: string;
  order: number;
  plannedDate: Date;
  actualDate: Date | null;
  /** Legacy % — kept for callers not yet migrated. New UI reads billingWeightPct. */
  billingPct: string;
  billingWeightPct: string | null;
  status: string;
  templateCode: string | null;
  family: string | null;
  autoCompleted: boolean;
  sourceEvent: string | null;
  completedAt: Date | null;
};

export type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  completedAt: Date | null;
  assignedToId: string;
  assignedToName: string;
};

export type ProjectMember = { id: string; name: string };

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

  // Lazy backfill: legacy projects created before milestones were auto-
  // seeded still exist in the DB with zero rows. Seed the common spine
  // the first time the detail page is opened so the panel is never empty.
  const existing = await db.milestone.count({ where: { projectId } });
  if (existing === 0) {
    const { generateMilestonesForProject } = await import("@/kernel/milestones/generate");
    await withTransaction(async (tx: TxClient) => {
      await generateMilestonesForProject(tx, {
        orgId:     ctx.orgId,
        projectId,
        families:  [],
      });
    }, { orgId: ctx.orgId });
  }

  const rows = await db.milestone.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: {
      id: true, name: true, order: true, plannedDate: true,
      actualDate: true, billingPct: true, status: true,
      templateCode: true, family: true, autoCompleted: true,
      sourceEvent: true, completedAt: true, billingWeightPct: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    billingPct: r.billingPct.toString(),
    billingWeightPct: r.billingWeightPct ? r.billingWeightPct.toString() : null,
  }));
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
      assignedToId: true,
    },
  });
  const assigneeIds = Array.from(new Set(rows.map((r) => r.assignedToId)));
  const assignees = assigneeIds.length === 0 ? [] :
    await db.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } });
  const nameById = new Map(assignees.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    ...r,
    dueDate: r.dueAt,
    assignedToName: nameById.get(r.assignedToId) ?? "—",
  }));
}

export async function getProjectAssignableUsers(ctx: RequestContext): Promise<ProjectMember[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  return db.user.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
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

// ── Redesign — measurement rounds shown on the project detail page ──
export type ProjectMeasurementRow = {
  id: string;
  number: string;
  visitedAt: Date;
  status: string; // MeasurementStatus
  revision: number;
  supersedesId: string | null;
  measuredByName: string;
  itemCount: number;
  roomsCovered: number;
};

export async function getProjectMeasurements(
  ctx: RequestContext,
  projectId: string,
): Promise<ProjectMeasurementRow[]> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);
  const rows = await db.measurement.findMany({
    where:   { projectId },
    orderBy: [{ revision: "desc" }, { visitedAt: "desc" }],
    select: {
      id: true, number: true, visitedAt: true, status: true, revision: true,
      supersedesId: true, measuredById: true,
      _count: { select: { items: true } },
      items: { select: { roomId: true }, distinct: ["roomId"] },
    },
  });
  // Measurement has no `measuredBy` relation defined in schema — fetch
  // the measurer names in one round-trip and stitch them in.
  const measurerIds = Array.from(new Set(rows.map((r) => r.measuredById)));
  const measurers = measurerIds.length === 0 ? [] :
    await db.user.findMany({
      where:  { id: { in: measurerIds } },
      select: { id: true, name: true },
    });
  const nameById = new Map(measurers.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    visitedAt: r.visitedAt,
    status: r.status,
    revision: r.revision,
    supersedesId: r.supersedesId,
    measuredByName: nameById.get(r.measuredById) ?? "—",
    itemCount: r._count.items,
    roomsCovered: new Set(r.items.map((i) => i.roomId)).size,
  }));
}

export * from "./queries-detail-money";
