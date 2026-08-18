// Split out of queries.ts to stay under the §10 300-line limit.

import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { MakeJobDetail } from "./queries";

export async function getMakeJob(
  ctx: RequestContext,
  jobId: string,
): Promise<MakeJobDetail | null> {
  requirePermission(ctx, "make.view");
  const job = await orgPrisma(ctx.orgId).makeJob.findFirst({
    where: { id: jobId, organizationId: ctx.orgId },
    select: {
      id: true, number: true, status: true, priority: true,
      targetDate: true, startedAt: true, completedAt: true,
      projectId: true, orderId: true,
      vendorId: true, assignedToId: true,
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true, orderLineId: true, measurementItemId: true,
          roomLabel: true, panels: true, cutLengthMm: true,
          fabricIssuedM: true, liningIssuedM: true,
          headingType: true, eyeletCount: true, stitchSpec: true,
          actualUsedM: true, wastageM: true, qcPassed: true, qcNotes: true,
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, actorId: true, type: true,
          fromStatus: true, toStatus: true, payload: true, createdAt: true,
        },
      },
    },
  });
  if (!job) return null;

  const measItemIds = [...new Set(job.lines.map((l) => l.measurementItemId).filter(Boolean))] as string[];
  const actorIds    = [...new Set(job.events.map((e) => e.actorId))];

  const [project, vendor, assignedTo, orderLines, measItems, actors] = await Promise.all([
    orgPrisma(ctx.orgId).project.findUnique({
      where: { id: job.projectId },
      select: {
        name: true,
        client: { select: { name: true } },
        orders: { where: { id: job.orderId }, select: { number: true }, take: 1 },
      },
    }),
    job.vendorId
      ? orgPrisma(ctx.orgId).vendor.findUnique({ where: { id: job.vendorId }, select: { name: true } })
      : null,
    job.assignedToId
      ? orgPrisma(ctx.orgId).employee.findUnique({ where: { id: job.assignedToId }, select: { name: true } })
      : null,
    orgPrisma(ctx.orgId).orderLine.findMany({
      where: { id: { in: job.lines.map((l) => l.orderLineId) } },
      select: { id: true, description: true, colourwayId: true },
    }),
    measItemIds.length > 0
      ? orgPrisma(ctx.orgId).measurementItem.findMany({
          where: { id: { in: measItemIds } },
          select: { id: true, measurement: { select: { number: true, status: true } } },
        })
      : Promise.resolve([]),
    actorIds.length > 0
      ? orgPrisma(ctx.orgId).user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const cwIds = [...new Set(orderLines.map((l) => l.colourwayId).filter(Boolean))] as string[];
  const colourways = cwIds.length > 0
    ? await orgPrisma(ctx.orgId).colourway.findMany({ where: { id: { in: cwIds } }, select: { id: true, code: true, colourName: true } })
    : [];

  const cwMap       = new Map(colourways.map((c) => [c.id, c]));
  const orderLineMap = new Map(orderLines.map((l) => [l.id, l]));
  const measMap     = new Map(measItems.map((m) => [m.id, m.measurement]));
  const actorMap    = new Map(actors.map((u) => [u.id, u.name]));

  return {
    id:             job.id,
    number:         job.number,
    status:         job.status,
    priority:       job.priority,
    targetDate:     job.targetDate,
    startedAt:      job.startedAt,
    completedAt:    job.completedAt,
    projectId:      job.projectId,
    projectName:    project?.name ?? "—",
    clientName:     project?.client.name ?? "—",
    orderId:        job.orderId,
    orderNumber:    project?.orders[0]?.number ?? "—",
    vendorName:     vendor?.name ?? null,
    assignedToName: assignedTo?.name ?? null,
    lines: job.lines.map((l) => {
      const ol   = orderLineMap.get(l.orderLineId);
      const meas = l.measurementItemId ? measMap.get(l.measurementItemId) : null;
      return {
        id:                  l.id,
        orderLineId:         l.orderLineId,
        measurementItemId:   l.measurementItemId,
        measurementNumber:   meas?.number ?? null,
        measurementStatus:   meas?.status ?? null,
        roomLabel:           l.roomLabel,
        panels:              l.panels,
        cutLengthMm:         l.cutLengthMm?.toString() ?? null,
        fabricIssuedM:       l.fabricIssuedM?.toString() ?? null,
        liningIssuedM:       l.liningIssuedM?.toString() ?? null,
        headingType:         l.headingType,
        eyeletCount:         l.eyeletCount,
        stitchSpec:          l.stitchSpec,
        actualUsedM:         l.actualUsedM?.toString() ?? null,
        wastageM:            l.wastageM?.toString() ?? null,
        qcPassed:            l.qcPassed,
        qcNotes:             l.qcNotes,
        description:         ol?.description ?? "—",
        colourwayCode:       ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.code ?? null) : null,
        colourName:          ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.colourName ?? null) : null,
      };
    }),
    events: job.events.map((e) => ({
      id:         e.id,
      actorId:    e.actorId,
      actorName:  actorMap.get(e.actorId) ?? "System",
      type:       e.type,
      fromStatus: e.fromStatus,
      toStatus:   e.toStatus,
      payload:    e.payload as Record<string, unknown>,
      createdAt:  e.createdAt,
    })),
  };
}
