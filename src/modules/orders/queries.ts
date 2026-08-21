import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { type OrderStatus } from "./schema";
import { buildWhere } from "./queries-part2";

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
  totalValue: bigint;
  advanceRequired: bigint;
  advanceReceived: bigint;
  quotationId: string | null;
  quotationNumber: string | null;
  makeJobId: string | null;
  makeJobStatus: string | null;
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

export * from "./queries-part2";
