import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";
import { buildWhere, orderFor } from "./queries-part2";

export interface ListInvoicesQuery {
  search?:   string;
  status?:   string;
  clientId?: string;
  page?:     number;
  pageSize?: number;
  sort?:     "recent" | "oldest" | "total" | "duesoon";
}

export interface InvoiceRow {
  id:          string;
  number:      string;
  type:        string;
  clientId:    string;
  clientName:  string;
  clientMobile: string;
  date:        Date;
  dueDate:     Date;
  status:      string;
  irnStatus:   string;
  total:       bigint;
  advanceAdjusted: bigint;
  paidTotal:   bigint;
  outstanding: bigint;
  overdueBy:   number;
  orderNumber: string | null;
}

export interface ListInvoicesResult {
  rows:     InvoiceRow[];
  total:    number;
  page:     number;
  pageSize: number;
}

export interface InvoiceLineRow {
  id:         string;
  lineNo:     number;
  orderLineId: string | null;
  description: string;
  hsn:        string;
  quantity:   string;
  unit:       string;
  rate:       bigint;
  taxable:    bigint;
  gstRate:    string;
  cgst:       bigint;
  sgst:       bigint;
  igst:       bigint;
  amount:     bigint;
}

export interface InvoiceDetail {
  id:                string;
  number:            string;
  type:              string;
  status:            string;
  irnStatus:         string;
  irn:               string | null;
  ackNo:             string | null;
  ackDate:           Date | null;
  clientId:          string;
  clientName:        string;
  clientMobile:      string;
  clientGstin:       string | null;
  branchId:          string;
  branchName:        string;
  supplierStateCode: string;
  placeOfSupplyCode: string;
  date:              Date;
  dueDate:           Date;
  cancelledAt:       Date | null;
  cancelReason:      string | null;
  taxableAmount:     bigint;
  cgst:              bigint;
  sgst:              bigint;
  igst:              bigint;
  roundOff:          bigint;
  total:             bigint;
  advanceAdjusted:   bigint;
  paidTotal:         bigint;
  outstanding:       bigint;
  orderId:           string | null;
  orderNumber:       string | null;
  projectId:         string | null;
  lines:             InvoiceLineRow[];
  allocations:       { id: string; receiptId: string; amount: bigint; date: Date }[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE     = 100;

export async function listInvoices(
  ctx: RequestContext,
  q: ListInvoicesQuery,
): Promise<ListInvoicesResult> {
  requirePermission(ctx, "invoice.view");
  const db      = scoped(ctx);
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;
  const now      = new Date();

  const where = buildWhere(q, now);
  const orderBy = orderFor(q.sort);

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where, orderBy, skip, take: pageSize,
      select: {
        id: true, number: true, type: true, date: true, dueDate: true,
        status: true, irnStatus: true, total: true, advanceAdjusted: true,
        clientId: true, orderId: true,
      },
    }),
    db.invoice.count({ where }),
  ]);

  if (invoices.length === 0) {
    return { rows: [], total, page, pageSize };
  }

  const invoiceIds = invoices.map((i) => i.id);
  const orderIds   = invoices.filter((i) => i.orderId).map((i) => i.orderId!);

  // Batch-fetch clients, orders, allocation sums — no back-relation on Invoice
  const clientIds = [...new Set(invoices.map((i) => i.clientId))];
  const [clients, orders, allocationSums] = await Promise.all([
    db.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, mobile: true },
    }),
    orderIds.length > 0
      ? db.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
      : Promise.resolve([]),
    db.receiptAllocation.groupBy({
      by: ["invoiceId"],
      where: { invoiceId: { in: invoiceIds } },
      _sum: { amount: true },
    }),
  ]);

  const clientMap     = new Map(clients.map((c) => [c.id, c]));
  const orderMap      = new Map((orders as { id: string; number: string }[]).map((o) => [o.id, o]));
  const allocationMap = new Map(allocationSums.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));

  const rows: InvoiceRow[] = invoices.map((inv) => {
    const client     = clientMap.get(inv.clientId);
    const paidTotal  = allocationMap.get(inv.id) ?? 0n;
    const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, paidTotal);
    const overdueBy  = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
    return {
      id: inv.id, number: inv.number, type: inv.type,
      clientId: inv.clientId, clientName: client?.name ?? "—", clientMobile: client?.mobile ?? "",
      date: inv.date, dueDate: inv.dueDate, status: inv.status, irnStatus: inv.irnStatus,
      total: inv.total, advanceAdjusted: inv.advanceAdjusted, paidTotal, outstanding,
      overdueBy,
      orderNumber: inv.orderId ? orderMap.get(inv.orderId)?.number ?? null : null,
    };
  });

  return { rows, total, page, pageSize };
}

// ── Redesign — KPI tiles on the invoicing landing page ──
// One aggregate roundtrip that covers everything the header tiles need,
// so the page loader stays one Promise.all wide instead of five.

export * from "./queries-part2";
