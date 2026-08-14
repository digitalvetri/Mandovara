import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { ORDER_STATUSES, type OrderStatus } from "./schema";

export interface ListOrdersQuery {
  search?: string;
  status?: OrderStatus | "ALL" | "OPEN";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "total";
}

export interface OrderRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  date: Date;
  status: string;
  totalValue: bigint;
  lineCount: number;
  quotationId: string | null;
}

export interface ListOrdersResult {
  rows: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderStatusCounts {
  byStatus: Record<OrderStatus, number>;
  open:     number;
  total:    number;
}

export interface InstallVisitSummary {
  id:          string;
  number:      string;
  scheduledAt: Date;
  status:      string;
  completedAt: Date | null;
}

export interface OrderLineRow {
  id: string;
  lineNo: number;
  colourwayId: string | null;
  serviceRateId: string | null;
  measurementItemId: string | null;
  description: string;
  quantity: string;
  unit: string;
  rate: bigint;
  amount: bigint;
  procuredQty: string;
  madeQty: string;
  installedQty: string;
  dispatchedQty: string;
  remainingQty: string;
}

export interface OrderDetail {
  id: string;
  number: string;
  status: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  branchId: string;
  branchName: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  salesExecName: string | null;
  date: Date;
  promisedInstallAt: Date | null;
  totalValue: bigint;
  advanceRequired: bigint;
  advanceReceived: bigint;
  quotationId: string | null;
  quotationNumber: string | null;
  makeJobId: string | null;
  makeJobStatus: string | null;
  installVisits: InstallVisitSummary[];
  invoicedTotal: bigint;
  paidTotal: bigint;
  lines: OrderLineRow[];
}

export interface AcceptedQuotationOption {
  id: string;
  number: string;
  clientName: string;
  total: bigint;
  date: Date;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listOrders(
  ctx: RequestContext,
  q: ListOrdersQuery,
): Promise<ListOrdersResult> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy:
        q.sort === "oldest" ? { date: "asc" }
        : q.sort === "total" ? { totalValue: "desc" }
        :                      { date: "desc" },
      skip, take: pageSize,
      select: {
        id: true, number: true, date: true, status: true, totalValue: true,
        clientId: true, quotationId: true,
        project: { select: { client: { select: { name: true } } } },
        _count: { select: { lines: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      clientId: r.clientId,
      clientName: r.project.client.name,
      date: r.date,
      status: r.status,
      totalValue: r.totalValue,
      lineCount: r._count.lines,
      quotationId: r.quotationId,
    })),
    total, page, pageSize,
  };
}

export async function getOrder(
  ctx: RequestContext,
  id: string,
): Promise<OrderDetail | null> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const row = await db.order.findUnique({
    where: { id },
    select: {
      id: true, number: true, status: true, branchId: true, projectId: true,
      clientId: true, quotationId: true,
      date: true, promisedInstallAt: true,
      totalValue: true, advanceRequired: true, advanceReceived: true,
      project: {
        select: {
          number: true, name: true, ownerId: true,
          client: { select: { id: true, name: true, mobile: true } },
        },
      },
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true,
          colourwayId: true, serviceRateId: true, measurementItemId: true,
          quantity: true, unit: true, rate: true, amount: true,
          procuredQty: true, madeQty: true, installedQty: true,
        },
      },
    },
  });
  if (!row) return null;

  const [branch, quotationNumber, ownerUser, makeJob, installVisits, invoices, dispatchedLines] = await Promise.all([
    db.branch.findUniqueOrThrow({ where: { id: row.branchId }, select: { name: true } }),
    row.quotationId
      ? db.quotation.findUnique({ where: { id: row.quotationId }, select: { number: true } }).then((r) => r?.number ?? null)
      : Promise.resolve(null),
    db.user.findFirst({ where: { id: row.project.ownerId }, select: { name: true } }),
    db.makeJob.findFirst({
      where: { orderId: id },
      orderBy: { number: "desc" },
      select: { id: true, status: true },
    }),
    db.installVisit.findMany({
      where: { orderId: id },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, number: true, scheduledAt: true, status: true, completedAt: true },
    }),
    db.invoice.findMany({ where: { orderId: id }, select: { id: true, total: true } }),
    db.installLine.findMany({
      where: { visit: { orderId: id, status: { not: "CANCELLED" } } },
      select: { orderLineId: true, plannedQty: true },
    }),
  ]);

  const dispatchedByLine = new Map<string, number>();
  for (const dl of dispatchedLines) {
    dispatchedByLine.set(
      dl.orderLineId,
      (dispatchedByLine.get(dl.orderLineId) ?? 0) + Number(dl.plannedQty),
    );
  }

  const invoicedTotal = invoices.reduce((s, i) => s + i.total, 0n);

  let paidTotal = 0n;
  if (invoices.length > 0) {
    const invoiceIds = invoices.map((i) => i.id);
    const allocations = await db.receiptAllocation.findMany({
      where: { invoiceId: { in: invoiceIds } },
      select: { amount: true },
    });
    paidTotal = allocations.reduce((s, a) => s + a.amount, 0n);
  }

  return {
    id: row.id,
    number: row.number,
    status: row.status,
    clientId: row.clientId,
    clientName: row.project.client.name,
    clientMobile: row.project.client.mobile,
    branchId: row.branchId,
    branchName: branch.name,
    projectId: row.projectId,
    projectNumber: row.project.number,
    projectName: row.project.name,
    salesExecName: ownerUser?.name ?? null,
    date: row.date,
    promisedInstallAt: row.promisedInstallAt,
    totalValue: row.totalValue,
    advanceRequired: row.advanceRequired,
    advanceReceived: row.advanceReceived,
    quotationId: row.quotationId,
    quotationNumber,
    makeJobId: makeJob?.id ?? null,
    makeJobStatus: makeJob?.status ?? null,
    installVisits,
    invoicedTotal,
    paidTotal,
    lines: row.lines.map((l) => {
      const dispatched = dispatchedByLine.get(l.id) ?? 0;
      const remaining  = Math.max(0, Number(l.quantity) - dispatched);
      return {
        id: l.id,
        lineNo: l.lineNo,
        description: l.description,
        colourwayId: l.colourwayId,
        serviceRateId: l.serviceRateId,
        measurementItemId: l.measurementItemId,
        quantity: l.quantity.toString(),
        unit: l.unit,
        rate: l.rate,
        amount: l.amount,
        procuredQty: l.procuredQty.toString(),
        madeQty: l.madeQty.toString(),
        installedQty: l.installedQty.toString(),
        dispatchedQty: dispatched.toFixed(2),
        remainingQty:  remaining.toFixed(2),
      };
    }),
  };
}

export async function getOrderSummaryCounts(
  ctx: RequestContext,
): Promise<OrderStatusCounts> {
  requirePermission(ctx, "order.view");
  const db = scoped(ctx);

  const groups = await db.order.groupBy({ by: ["status"], _count: { id: true } });

  const byStatus = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, 0]),
  ) as Record<OrderStatus, number>;

  let total = 0;
  for (const g of groups) {
    byStatus[g.status as OrderStatus] = g._count.id;
    total += g._count.id;
  }

  const open = total - (byStatus.COMPLETED ?? 0) - (byStatus.CANCELLED ?? 0) - (byStatus.DRAFT ?? 0);
  return { byStatus, open, total };
}

export async function listAcceptedQuotations(
  ctx: RequestContext,
): Promise<AcceptedQuotationOption[]> {
  requirePermission(ctx, "order.create");
  const db = scoped(ctx);
  const rows = await db.quotation.findMany({
    where: { status: "ACCEPTED" },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true, number: true, total: true, date: true, clientId: true,
      project: { select: { client: { select: { name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    clientName: r.project.client.name,
    total: r.total,
    date: r.date,
  }));
}

// ── helpers ──────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListOrdersQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { project: { client: { name: { contains: s, mode: "insensitive" } } } },
    ];
  }
  if (q.status === "OPEN") {
    where["status"] = { notIn: ["COMPLETED", "CANCELLED"] };
  } else if (q.status && q.status !== "ALL") {
    where["status"] = q.status;
  }
  return where;
}
