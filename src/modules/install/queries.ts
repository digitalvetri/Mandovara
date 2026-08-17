import { prisma as db } from "@/kernel/db/client";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { InstallStatus } from "@/kernel/db/client";

export interface InstallVisitRow {
  id: string;
  number: string;
  scheduledAt: Date;
  status: InstallStatus;
  projectId: string;
  projectName: string;
  clientName: string;
  siteAddress: unknown;
  crewName: string | null;
  lineCount: number;
  snagCount: number;
  completedAt: Date | null;
  customerConfirmedAt: Date | null;
  orderId: string;
  orderNumber: string;
}

export interface InstallStatusCounts {
  SCHEDULED: number;
  ASSIGNED: number;
  IN_PROGRESS: number;
  COMPLETED: number;
  SNAGGING: number;
  CUSTOMER_CONFIRMED: number;
  CLOSED: number;
  total: number;
}

export interface EligibleOrder {
  id: string;
  number: string;
  clientName: string;
  projectName: string;
  projectId: string;
  status: string;
  lineCount: number;
  promisedInstallAt: Date | null;
}

export async function listInstallVisits(
  ctx: RequestContext,
  opts: { status?: InstallStatus[]; dateFrom?: Date; dateTo?: Date } = {},
): Promise<InstallVisitRow[]> {
  requirePermission(ctx, "install.view");
  const visits = await db.installVisit.findMany({
    where: {
      organizationId: ctx.orgId,
      kind: "INSTALL",
      ...(opts.status?.length ? { status: { in: opts.status } } : {}),
      ...(opts.dateFrom || opts.dateTo ? {
        scheduledAt: {
          ...(opts.dateFrom ? { gte: opts.dateFrom } : {}),
          ...(opts.dateTo   ? { lte: opts.dateTo   } : {}),
        },
      } : {}),
    },
    orderBy: [{ scheduledAt: "asc" }, { number: "asc" }],
    select: {
      id: true, number: true, scheduledAt: true, status: true,
      projectId: true, orderId: true, crewId: true,
      completedAt: true, customerConfirmedAt: true,
      _count: { select: { lines: true, snags: true } },
    },
  });

  if (visits.length === 0) return [];

  const projectIds = [...new Set(visits.map((v) => v.projectId))];
  const crewIds    = [...new Set(visits.map((v) => v.crewId).filter(Boolean))] as string[];
  const orderIds   = [...new Set(visits.map((v) => v.orderId))];

  const [projects, crews, orders] = await Promise.all([
    db.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, siteAddress: true, client: { select: { name: true } } },
    }),
    crewIds.length > 0
      ? db.installCrew.findMany({ where: { id: { in: crewIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    orderIds.length > 0
      ? db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
      : Promise.resolve([]),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const crewMap    = new Map(crews.map((c) => [c.id, c.name]));
  const orderMap   = new Map(orders.map((o) => [o.id, o.number]));

  return visits.map((v) => {
    const project = projectMap.get(v.projectId);
    return {
      id: v.id, number: v.number, scheduledAt: v.scheduledAt, status: v.status,
      projectId: v.projectId, orderId: v.orderId,
      projectName: project?.name ?? "—",
      clientName: project?.client.name ?? "—",
      siteAddress: project?.siteAddress ?? null,
      crewName: v.crewId ? (crewMap.get(v.crewId) ?? null) : null,
      lineCount: v._count.lines,
      snagCount: v._count.snags,
      completedAt: v.completedAt,
      customerConfirmedAt: v.customerConfirmedAt,
      orderNumber: orderMap.get(v.orderId) ?? "—",
    };
  });
}

export async function getInstallStatusCounts(ctx: RequestContext): Promise<InstallStatusCounts> {
  requirePermission(ctx, "install.view");
  const groups = await db.installVisit.groupBy({
    by: ["status"],
    where: { organizationId: ctx.orgId, kind: "INSTALL" },
    _count: { id: true },
  });
  const counts: InstallStatusCounts = {
    SCHEDULED: 0, ASSIGNED: 0, IN_PROGRESS: 0, COMPLETED: 0,
    SNAGGING: 0, CUSTOMER_CONFIRMED: 0, CLOSED: 0, total: 0,
  };
  for (const g of groups) {
    const k = g.status as keyof InstallStatusCounts;
    if (k in counts && k !== "total") (counts as unknown as Record<string, number>)[k] = g._count.id;
    counts.total += g._count.id;
  }
  return counts;
}

export async function listEligibleOrders(ctx: RequestContext): Promise<EligibleOrder[]> {
  requirePermission(ctx, "install.view");
  const orders = await db.order.findMany({
    where: {
      organizationId: ctx.orgId,
      status: { in: ["CONFIRMED", "PROCUREMENT", "MAKE", "READY_TO_INSTALL"] },
    },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true, number: true, status: true, promisedInstallAt: true,
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      _count: { select: { lines: true } },
    },
  });

  const orderIds = orders.map((o) => o.id);
  const existing = orderIds.length > 0
    ? await db.installVisit.findMany({
        where: {
          organizationId: ctx.orgId, kind: "INSTALL",
          orderId: { in: orderIds }, status: { not: "CANCELLED" },
        },
        select: { orderId: true },
      })
    : [];
  const alreadyScheduled = new Set(existing.map((e) => e.orderId));

  return orders
    .filter((o) => !alreadyScheduled.has(o.id))
    .map((o) => ({
      id: o.id, number: o.number, status: o.status,
      clientName: o.project.client.name,
      projectName: o.project.name, projectId: o.project.id,
      lineCount: o._count.lines, promisedInstallAt: o.promisedInstallAt,
    }));
}

export async function listInstallCrews(ctx: RequestContext) {
  return db.installCrew.findMany({
    where: { organizationId: ctx.orgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export interface SnagListRow {
  id:          string;
  description: string;
  status:      string;
  raisedAt:    Date;
  roomLabel:   string | null;
  projectId:   string;
  projectName: string;
  clientName:  string;
}

export async function listOpenSnags(ctx: RequestContext): Promise<SnagListRow[]> {
  requirePermission(ctx, "install.view");
  const snags = await db.snag.findMany({
    where: {
      organizationId: ctx.orgId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    orderBy: { raisedAt: "asc" },
    select: {
      id: true, description: true, status: true,
      raisedAt: true, roomLabel: true, projectId: true,
    },
  });

  if (snags.length === 0) return [];

  const projectIds = [...new Set(snags.map((s) => s.projectId))];
  const projects   = await db.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
  const projMap = new Map(projects.map((p) => [p.id, p]));

  return snags.map((s) => {
    const proj = projMap.get(s.projectId);
    return {
      id:          s.id,
      description: s.description,
      status:      s.status,
      raisedAt:    s.raisedAt,
      roomLabel:   s.roomLabel,
      projectId:   s.projectId,
      projectName: proj?.name ?? "—",
      clientName:  proj?.client.name ?? "—",
    };
  });
}
