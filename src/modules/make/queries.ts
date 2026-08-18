/* eslint-disable max-lines -- FIXME: split into smaller files (currently 301 lines) */
import { orgPrisma } from "@/kernel/db/rls";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MakeJobStatus } from "@/kernel/db/client";

export interface MakeJobRow {
  id: string;
  number: string;
  status: MakeJobStatus;
  priority: number;
  targetDate: Date | null;
  startedAt: Date | null;
  projectId: string;
  projectName: string;
  clientName: string;
  orderId: string;
  orderNumber: string;
  vendorName: string | null;
  assignedToName: string | null;
  lineCount: number;
  completedAt: Date | null;
  measurementRevision: string | null;
}

export interface MakeJobEventRow {
  id: string;
  actorId: string;
  actorName: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface MakeJobLineDetail {
  id: string;
  orderLineId: string;
  measurementItemId: string | null;
  measurementNumber: string | null;
  measurementStatus: string | null;
  roomLabel: string;
  panels: number | null;
  cutLengthMm: string | null;
  fabricIssuedM: string | null;
  liningIssuedM: string | null;
  headingType: string | null;
  eyeletCount: number | null;
  stitchSpec: string | null;
  actualUsedM: string | null;
  wastageM: string | null;
  qcPassed: boolean;
  qcNotes: string | null;
  description: string;
  colourwayCode: string | null;
  colourName: string | null;
}

export interface MakeJobDetail {
  id: string;
  number: string;
  status: MakeJobStatus;
  priority: number;
  targetDate: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  projectId: string;
  projectName: string;
  clientName: string;
  orderId: string;
  orderNumber: string;
  vendorName: string | null;
  assignedToName: string | null;
  lines: MakeJobLineDetail[];
  events: MakeJobEventRow[];
}

export async function listMakeJobs(
  ctx: RequestContext,
  opts: { status?: MakeJobStatus[] } = {},
): Promise<MakeJobRow[]> {
  requirePermission(ctx, "make.view");
  const jobs = await orgPrisma(ctx.orgId).makeJob.findMany({
    where: {
      organizationId: ctx.orgId,
      ...(opts.status?.length ? { status: { in: opts.status } } : {}),
    },
    orderBy: [{ priority: "desc" }, { targetDate: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      status: true,
      priority: true,
      targetDate: true,
      startedAt: true,
      completedAt: true,
      projectId: true,
      orderId: true,
      vendorId: true,
      assignedToId: true,
      _count: { select: { lines: true } },
    },
  });

  if (jobs.length === 0) return [];

  const jobIds      = jobs.map((j) => j.id);
  const projectIds  = [...new Set(jobs.map((j) => j.projectId))];
  const vendorIds   = [...new Set(jobs.map((j) => j.vendorId).filter(Boolean))] as string[];
  const assigneeIds = [...new Set(jobs.map((j) => j.assignedToId).filter(Boolean))] as string[];
  const orderIds    = [...new Set(jobs.map((j) => j.orderId))];

  // Fetch the first measurementItemId per job via a separate query (avoids nested where in select)
  const firstLines = await orgPrisma(ctx.orgId).makeJobLine.findMany({
    where: { makeJobId: { in: jobIds }, measurementItemId: { not: null } },
    select: { makeJobId: true, measurementItemId: true },
    distinct: ["makeJobId"],
  });
  const jobMeasItemMap = new Map(
    firstLines.map((l) => [l.makeJobId, l.measurementItemId!]),
  );
  const measItemIds = [...new Set(firstLines.map((l) => l.measurementItemId!))];

  const [projects, vendors, assignees, orders, measItems] = await Promise.all([
    orgPrisma(ctx.orgId).project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    vendorIds.length > 0
      ? orgPrisma(ctx.orgId).vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    assigneeIds.length > 0
      ? orgPrisma(ctx.orgId).employee.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
    orderIds.length > 0
      ? orgPrisma(ctx.orgId).order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
      : Promise.resolve([]),
    measItemIds.length > 0
      ? orgPrisma(ctx.orgId).measurementItem.findMany({
          where: { id: { in: measItemIds } },
          select: { id: true, measurement: { select: { number: true, status: true } } },
        })
      : Promise.resolve([]),
  ]);

  const projectMap  = new Map(projects.map((p) => [p.id, p]));
  const vendorMap   = new Map(vendors.map((v) => [v.id, v.name]));
  const assigneeMap = new Map(assignees.map((e) => [e.id, e.name]));
  const orderMap    = new Map(orders.map((o) => [o.id, o.number]));
  const measMap     = new Map(measItems.map((m) => [m.id, m.measurement]));

  return jobs.map((j) => {
    const project    = projectMap.get(j.projectId);
    const measItemId = jobMeasItemMap.get(j.id) ?? null;
    const meas       = measItemId ? measMap.get(measItemId) : null;
    const revLabel   = meas
      ? `${meas.number}${meas.status === "APPROVED" ? " ✓" : ""}`
      : null;

    return {
      id: j.id, number: j.number, status: j.status, priority: j.priority,
      targetDate: j.targetDate, startedAt: j.startedAt, completedAt: j.completedAt,
      projectId: j.projectId, orderId: j.orderId,
      projectName: project?.name ?? "—", clientName: project?.client.name ?? "—",
      orderNumber: orderMap.get(j.orderId) ?? "—",
      vendorName: j.vendorId ? (vendorMap.get(j.vendorId) ?? null) : null,
      assignedToName: j.assignedToId ? (assigneeMap.get(j.assignedToId) ?? null) : null,
      lineCount: j._count.lines, measurementRevision: revLabel,
    };
  });
}

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
