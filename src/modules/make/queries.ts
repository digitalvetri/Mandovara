import { prisma as db } from "@/kernel/db/client";
import type { RequestContext } from "@/kernel/auth/context";
import type { MakeJobStatus } from "@/kernel/db/client";

export interface MakeJobRow {
  id: string;
  number: string;
  status: MakeJobStatus;
  targetDate: Date | null;
  projectId: string;
  projectName: string;
  clientName: string;
  orderNumber: string;
  vendorName: string | null;
  lineCount: number;
  completedAt: Date | null;
}

export interface MakeJobLineDetail {
  id: string;
  orderLineId: string;
  measurementItemId: string | null;
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
}

export async function listMakeJobs(
  ctx: RequestContext,
  opts: { status?: MakeJobStatus[] } = {},
): Promise<MakeJobRow[]> {
  const jobs = await db.makeJob.findMany({
    where: {
      organizationId: ctx.orgId,
      ...(opts.status?.length ? { status: { in: opts.status } } : {}),
    },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { number: "asc" }],
    select: {
      id: true,
      number: true,
      status: true,
      targetDate: true,
      projectId: true,
      completedAt: true,
      vendorId: true,
      _count: { select: { lines: true } },
    },
  });

  if (jobs.length === 0) return [];

  const projectIds = [...new Set(jobs.map((j) => j.projectId))];
  const vendorIds = [...new Set(jobs.map((j) => j.vendorId).filter(Boolean))] as string[];

  const [projects, vendors] = await Promise.all([
    db.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true, name: true,
        client: { select: { name: true } },
        orders: { select: { id: true, number: true }, take: 1, orderBy: { date: "asc" } },
      },
    }),
    vendorIds.length > 0
      ? db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));

  return jobs.map((j) => {
    const project = projectMap.get(j.projectId)!;
    return {
      id: j.id,
      number: j.number,
      status: j.status,
      targetDate: j.targetDate,
      completedAt: j.completedAt,
      projectId: j.projectId,
      projectName: project?.name ?? "—",
      clientName: project?.client.name ?? "—",
      orderNumber: project?.orders[0]?.number ?? "—",
      vendorName: j.vendorId ? (vendorMap.get(j.vendorId) ?? null) : null,
      lineCount: j._count.lines,
    };
  });
}

export async function getMakeJob(
  ctx: RequestContext,
  jobId: string,
): Promise<MakeJobDetail | null> {
  const job = await db.makeJob.findFirst({
    where: { id: jobId, organizationId: ctx.orgId },
    select: {
      id: true, number: true, status: true,
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
    },
  });
  if (!job) return null;

  const [project, vendor, assignedTo, orderLines] = await Promise.all([
    db.project.findUnique({
      where: { id: job.projectId },
      select: {
        name: true,
        client: { select: { name: true } },
        orders: { where: { id: job.orderId }, select: { number: true }, take: 1 },
      },
    }),
    job.vendorId
      ? db.vendor.findUnique({ where: { id: job.vendorId }, select: { name: true } })
      : null,
    job.assignedToId
      ? db.employee.findUnique({ where: { id: job.assignedToId }, select: { name: true } })
      : null,
    db.orderLine.findMany({
      where: { id: { in: job.lines.map((l) => l.orderLineId) } },
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
    id: job.id,
    number: job.number,
    status: job.status,
    targetDate: job.targetDate,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    projectId: job.projectId,
    projectName: project?.name ?? "—",
    clientName: project?.client.name ?? "—",
    orderId: job.orderId,
    orderNumber: project?.orders[0]?.number ?? "—",
    vendorName: vendor?.name ?? null,
    assignedToName: assignedTo?.name ?? null,
    lines: job.lines.map((l) => {
      const ol = orderLineMap.get(l.orderLineId);
      return {
        id: l.id,
        orderLineId: l.orderLineId,
        measurementItemId: l.measurementItemId,
        roomLabel: l.roomLabel,
        panels: l.panels,
        cutLengthMm: l.cutLengthMm?.toString() ?? null,
        fabricIssuedM: l.fabricIssuedM?.toString() ?? null,
        liningIssuedM: l.liningIssuedM?.toString() ?? null,
        headingType: l.headingType,
        eyeletCount: l.eyeletCount,
        stitchSpec: l.stitchSpec,
        actualUsedM: l.actualUsedM?.toString() ?? null,
        wastageM: l.wastageM?.toString() ?? null,
        qcPassed: l.qcPassed,
        qcNotes: l.qcNotes,
        description: ol?.description ?? "—",
        colourwayCode: ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.code ?? null) : null,
        colourName: ol?.colourwayId ? (cwMap.get(ol.colourwayId)?.colourName ?? null) : null,
      };
    }),
  };
}
