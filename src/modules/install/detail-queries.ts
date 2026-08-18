import { orgPrisma } from "@/kernel/db/rls";
import type { RequestContext } from "@/kernel/auth/context";
import type { InstallStatus } from "@/kernel/db/client";

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

export interface SnagRow {
  id: string;
  description: string;
  roomLabel: string | null;
  status: string;
  raisedAt: Date;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  assignedToName: string | null;
}

export interface InstallEventRow {
  id: string;
  actorId: string;
  actorName: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface InstallVisitDetail {
  id: string;
  number: string;
  scheduledAt: Date;
  assignedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  customerConfirmedAt: Date | null;
  status: InstallStatus;
  notes: string | null;
  clientSignatureKey: string | null;
  clientFeedbackRating: number | null;
  projectId: string;
  projectName: string;
  clientName: string;
  clientMobile: string;
  siteAddress: unknown;
  crewName: string | null;
  orderId: string;
  orderNumber: string;
  lines: InstallLineDetail[];
  snags: SnagRow[];
  events: InstallEventRow[];
}

export async function getInstallVisit(
  ctx: RequestContext,
  visitId: string,
): Promise<InstallVisitDetail | null> {
  const visit = await orgPrisma(ctx.orgId).installVisit.findFirst({
    where: { id: visitId, organizationId: ctx.orgId, kind: "INSTALL" },
    select: {
      id: true, number: true, scheduledAt: true, assignedAt: true,
      startedAt: true, completedAt: true, customerConfirmedAt: true,
      status: true, notes: true, clientSignatureKey: true, clientFeedbackRating: true,
      projectId: true, orderId: true, crewId: true,
      lines: {
        orderBy: { id: "asc" },
        select: { id: true, orderLineId: true, roomLabel: true, plannedQty: true, installedQty: true, dyeLotUsed: true, issue: true },
      },
      snags: {
        orderBy: { raisedAt: "desc" },
        select: { id: true, description: true, roomLabel: true, status: true, raisedAt: true, resolvedAt: true, resolutionNote: true, assignedToId: true },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, actorId: true, type: true, fromStatus: true, toStatus: true, payload: true, createdAt: true },
      },
    },
  });
  if (!visit) return null;

  const orderLineIds  = visit.lines.map((l) => l.orderLineId);
  const actorIds      = [...new Set(visit.events.map((e) => e.actorId))];
  const snagAssignees = [...new Set(visit.snags.map((s) => s.assignedToId).filter(Boolean))] as string[];

  const [project, crew, orderLines, actors, employees] = await Promise.all([
    orgPrisma(ctx.orgId).project.findUnique({
      where: { id: visit.projectId },
      select: {
        name: true, siteAddress: true,
        client: { select: { name: true, mobile: true } },
        orders: { where: { id: visit.orderId }, select: { number: true }, take: 1 },
      },
    }),
    visit.crewId ? orgPrisma(ctx.orgId).installCrew.findUnique({ where: { id: visit.crewId }, select: { name: true } }) : null,
    orderLineIds.length > 0
      ? orgPrisma(ctx.orgId).orderLine.findMany({ where: { id: { in: orderLineIds } }, select: { id: true, description: true, colourwayId: true } })
      : Promise.resolve([]),
    actorIds.length > 0
      ? orgPrisma(ctx.orgId).user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    snagAssignees.length > 0
      ? orgPrisma(ctx.orgId).employee.findMany({ where: { id: { in: snagAssignees } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const cwIds = [...new Set(orderLines.map((l) => l.colourwayId).filter(Boolean))] as string[];
  const colourways = cwIds.length > 0
    ? await orgPrisma(ctx.orgId).colourway.findMany({ where: { id: { in: cwIds } }, select: { id: true, code: true, colourName: true } })
    : [];

  const cwMap       = new Map(colourways.map((c) => [c.id, c]));
  const olMap       = new Map(orderLines.map((l) => [l.id, l]));
  const actorMap    = new Map(actors.map((u) => [u.id, u.name]));
  const empMap      = new Map(employees.map((e) => [e.id, e.name]));

  return {
    id: visit.id, number: visit.number, scheduledAt: visit.scheduledAt,
    assignedAt: visit.assignedAt, startedAt: visit.startedAt, completedAt: visit.completedAt,
    customerConfirmedAt: visit.customerConfirmedAt, status: visit.status,
    notes: visit.notes, clientSignatureKey: visit.clientSignatureKey,
    clientFeedbackRating: visit.clientFeedbackRating,
    projectId: visit.projectId, orderId: visit.orderId,
    projectName: project?.name ?? "—",
    clientName: project?.client.name ?? "—",
    clientMobile: project?.client.mobile ?? "",
    siteAddress: project?.siteAddress ?? null,
    crewName: crew?.name ?? null,
    orderNumber: project?.orders[0]?.number ?? "—",
    lines: visit.lines.map((l) => {
      const ol = olMap.get(l.orderLineId);
      return {
        id: l.id, orderLineId: l.orderLineId, roomLabel: l.roomLabel,
        description: ol?.description ?? "—",
        plannedQty: l.plannedQty.toString(), installedQty: l.installedQty.toString(),
        dyeLotUsed: l.dyeLotUsed, issue: l.issue,
        colourwayCode: ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.code ?? null) : null,
        colourName: ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.colourName ?? null) : null,
      };
    }),
    snags: visit.snags.map((s) => ({
      id: s.id, description: s.description, roomLabel: s.roomLabel,
      status: s.status, raisedAt: s.raisedAt, resolvedAt: s.resolvedAt,
      resolutionNote: s.resolutionNote,
      assignedToName: s.assignedToId ? (empMap.get(s.assignedToId) ?? null) : null,
    })),
    events: visit.events.map((e) => ({
      id: e.id, actorId: e.actorId, actorName: actorMap.get(e.actorId) ?? "System",
      type: e.type, fromStatus: e.fromStatus, toStatus: e.toStatus,
      payload: e.payload as Record<string, unknown>, createdAt: e.createdAt,
    })),
  };
}
