import { prisma as db } from "@/kernel/db/client";
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
  crewName: string | null;
  lineCount: number;
  completedAt: Date | null;
}

export interface InstallLineDetail {
  id: string;
  orderLineId: string;
  roomLabel: string;
  description: string;
  plannedQty: string;
  installedQty: string;
  dyeLotUsed: string | null;
  issue: string | null;
  colourwayCode: string | null;
  colourName: string | null;
}

export interface InstallVisitDetail {
  id: string;
  number: string;
  scheduledAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  status: InstallStatus;
  notes: string | null;
  clientSignatureKey: string | null;
  projectId: string;
  projectName: string;
  clientName: string;
  clientMobile: string;
  siteAddress: unknown;
  crewName: string | null;
  orderId: string;
  orderNumber: string;
  lines: InstallLineDetail[];
}

export async function listInstallVisits(
  ctx: RequestContext,
  opts: { status?: InstallStatus[] } = {},
): Promise<InstallVisitRow[]> {
  const visits = await db.installVisit.findMany({
    where: {
      organizationId: ctx.orgId,
      ...(opts.status?.length ? { status: { in: opts.status } } : {}),
    },
    orderBy: [{ scheduledAt: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      scheduledAt: true,
      status: true,
      projectId: true,
      completedAt: true,
      crewId: true,
      _count: { select: { lines: true } },
    },
  });

  if (visits.length === 0) return [];

  const projectIds = [...new Set(visits.map((v) => v.projectId))];
  const crewIds = [...new Set(visits.map((v) => v.crewId).filter(Boolean))] as string[];

  const [projects, crews] = await Promise.all([
    db.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        name: true,
        client: { select: { name: true } },
      },
    }),
    crewIds.length > 0
      ? db.installCrew.findMany({
          where: { id: { in: crewIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const crewMap = new Map(crews.map((c) => [c.id, c.name]));

  return visits.map((v) => {
    const project = projectMap.get(v.projectId);
    return {
      id: v.id,
      number: v.number,
      scheduledAt: v.scheduledAt,
      status: v.status,
      projectId: v.projectId,
      projectName: project?.name ?? "—",
      clientName: project?.client.name ?? "—",
      crewName: v.crewId ? (crewMap.get(v.crewId) ?? null) : null,
      lineCount: v._count.lines,
      completedAt: v.completedAt,
    };
  });
}

export async function getInstallVisit(
  ctx: RequestContext,
  visitId: string,
): Promise<InstallVisitDetail | null> {
  const visit = await db.installVisit.findFirst({
    where: { id: visitId, organizationId: ctx.orgId },
    select: {
      id: true,
      number: true,
      scheduledAt: true,
      startedAt: true,
      completedAt: true,
      status: true,
      notes: true,
      clientSignatureKey: true,
      projectId: true,
      orderId: true,
      crewId: true,
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          orderLineId: true,
          roomLabel: true,
          plannedQty: true,
          installedQty: true,
          dyeLotUsed: true,
          issue: true,
        },
      },
    },
  });
  if (!visit) return null;

  const [project, crew, orderLines] = await Promise.all([
    db.project.findUnique({
      where: { id: visit.projectId },
      select: {
        name: true,
        siteAddress: true,
        client: { select: { name: true, mobile: true } },
        orders: {
          where: { id: visit.orderId },
          select: { number: true },
          take: 1,
        },
      },
    }),
    visit.crewId
      ? db.installCrew.findUnique({ where: { id: visit.crewId }, select: { name: true } })
      : null,
    db.orderLine.findMany({
      where: { id: { in: visit.lines.map((l) => l.orderLineId) } },
      select: { id: true, description: true, colourwayId: true },
    }),
  ]);

  // Fetch colourways separately (OrderLine has no Prisma relation to Colourway)
  const cwIds = [...new Set(orderLines.map((l) => l.colourwayId).filter(Boolean))] as string[];
  const colourways = cwIds.length > 0
    ? await db.colourway.findMany({ where: { id: { in: cwIds } }, select: { id: true, code: true, colourName: true } })
    : [];
  const cwMap = new Map(colourways.map((c) => [c.id, c]));

  const orderLineMap = new Map(orderLines.map((l) => [l.id, l]));

  return {
    id: visit.id,
    number: visit.number,
    scheduledAt: visit.scheduledAt,
    startedAt: visit.startedAt,
    completedAt: visit.completedAt,
    status: visit.status,
    notes: visit.notes,
    clientSignatureKey: visit.clientSignatureKey,
    projectId: visit.projectId,
    projectName: project?.name ?? "—",
    clientName: project?.client.name ?? "—",
    clientMobile: project?.client.mobile ?? "",
    siteAddress: project?.siteAddress ?? null,
    crewName: crew?.name ?? null,
    orderId: visit.orderId,
    orderNumber: project?.orders[0]?.number ?? "—",
    lines: visit.lines.map((l) => {
      const ol = orderLineMap.get(l.orderLineId);
      return {
        id: l.id,
        orderLineId: l.orderLineId,
        roomLabel: l.roomLabel,
        description: ol?.description ?? "—",
        plannedQty: l.plannedQty.toString(),
        installedQty: l.installedQty.toString(),
        dyeLotUsed: l.dyeLotUsed,
        issue: l.issue,
        colourwayCode: ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.code ?? null) : null,
        colourName: ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.colourName ?? null) : null,
      };
    }),
  };
}

export async function listInstallCrews(ctx: RequestContext) {
  return db.installCrew.findMany({
    where: { organizationId: ctx.orgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
