import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface DispatchRow {
  id:                 string;
  number:             string;
  scheduledAt:        Date;
  status:             string;
  completedAt:        Date | null;
  orderId:            string;
  orderNumber:        string;
  clientName:         string;
  itemSummary:        string;
  vehicle:            string | null;
  expectedDeliveryAt: string | null;
}

export interface DispatchListResult {
  rows:     DispatchRow[];
  total:    number;
  page:     number;
  pageSize: number;
}

export interface DispatchStatusCounts {
  SCHEDULED:   number;
  IN_PROGRESS: number;
  COMPLETED:   number;
  PARTIAL:     number;
  RESCHEDULED: number;
  CANCELLED:   number;
  total:       number;
}

export interface DispatchableOrder {
  id:               string;
  number:           string;
  clientName:       string;
  status:           string;
  totalValue:       bigint;
  lineCount:        number;
  promisedInstallAt: Date | null;
}

export async function listDispatches(
  ctx: RequestContext,
  q: { page?: number; pageSize?: number; status?: string },
): Promise<DispatchListResult> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? 25, 100);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;
  const where: Record<string, unknown> = { kind: "DISPATCH" };
  if (q.status && q.status !== "ALL") where.status = q.status;

  const [visits, total] = await Promise.all([
    db.installVisit.findMany({
      where,
      orderBy:  { scheduledAt: "desc" },
      skip, take: pageSize,
      select: {
        id: true, number: true, orderId: true,
        scheduledAt: true, status: true, completedAt: true,
        checklist: true,
        project: { select: { client: { select: { name: true } } } },
        lines: { select: { orderLineId: true, plannedQty: true } },
      },
    }),
    db.installVisit.count({ where }),
  ]);

  const orderIds = [...new Set(visits.map((v) => v.orderId))];
  const lineIds  = [...new Set(visits.flatMap((v) => v.lines.map((l) => l.orderLineId)))];

  const [orders, orderLines] = await Promise.all([
    orderIds.length > 0
      ? db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
      : Promise.resolve([]),
    lineIds.length > 0
      ? db.orderLine.findMany({ where: { id: { in: lineIds } }, select: { id: true, description: true } })
      : Promise.resolve([]),
  ]);

  const orderMap   = new Map(orders.map((o) => [o.id, o.number]));
  const lineDescMap = new Map(orderLines.map((l) => [l.id, l.description]));

  return {
    rows: visits.map((v) => {
      const checklist  = (v.checklist ?? {}) as Record<string, string>;
      const descs      = v.lines.map((l) => lineDescMap.get(l.orderLineId) ?? "Item");
      const first      = descs[0] ?? "—";
      const itemSummary = descs.length > 1 ? `${first} +${descs.length - 1} more` : first;

      return {
        id:                 v.id,
        number:             v.number,
        scheduledAt:        v.scheduledAt,
        status:             v.status,
        completedAt:        v.completedAt,
        orderId:            v.orderId,
        orderNumber:        orderMap.get(v.orderId) ?? "—",
        clientName:         v.project.client.name,
        itemSummary,
        vehicle:            checklist.vehicle ?? null,
        expectedDeliveryAt: checklist.expectedDeliveryAt ?? null,
      };
    }),
    total, page, pageSize,
  };
}

export async function getDispatchStatusCounts(
  ctx: RequestContext,
): Promise<DispatchStatusCounts> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const groups = await db.installVisit.groupBy({ by: ["status"], where: { organizationId: ctx.orgId, kind: "DISPATCH" }, _count: { id: true } });
  const counts: DispatchStatusCounts = {
    SCHEDULED: 0, IN_PROGRESS: 0, COMPLETED: 0, PARTIAL: 0, RESCHEDULED: 0, CANCELLED: 0, total: 0,
  };
  for (const g of groups) {
    const k = g.status as keyof DispatchStatusCounts;
    if (k in counts && k !== "total") (counts as unknown as Record<string, number>)[k] = g._count.id;
    counts.total += g._count.id;
  }
  return counts;
}

export async function getDispatchableOrders(
  ctx: RequestContext,
): Promise<DispatchableOrder[]> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const rows = await db.order.findMany({
    where:   { status: { notIn: ["DRAFT", "CANCELLED", "COMPLETED"] } },
    orderBy: { date: "desc" },
    take:    200,
    select: {
      id: true, number: true, status: true, totalValue: true, promisedInstallAt: true,
      project: { select: { client: { select: { name: true } } } },
      _count: { select: { lines: true } },
    },
  });

  return rows.map((r) => ({
    id:               r.id,
    number:           r.number,
    clientName:       r.project.client.name,
    status:           r.status,
    totalValue:       r.totalValue,
    lineCount:        r._count.lines,
    promisedInstallAt: r.promisedInstallAt,
  }));
}
