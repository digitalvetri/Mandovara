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

export * from "./queries-part2";
