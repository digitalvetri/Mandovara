import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";

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

export async function getInvoice(
  ctx: RequestContext,
  id: string,
): Promise<InvoiceDetail | null> {
  requirePermission(ctx, "invoice.view");
  const db = scoped(ctx);

  const row = await db.invoice.findUnique({
    where: { id },
    select: {
      id: true, number: true, type: true, status: true, branchId: true,
      irnStatus: true, irn: true, ackNo: true, ackDate: true,
      date: true, dueDate: true, placeOfSupplyCode: true,
      cancelledAt: true, cancelReason: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, roundOff: true, total: true,
      advanceAdjusted: true,
      orderId: true, projectId: true, clientId: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, orderLineId: true, description: true, hsn: true,
          quantity: true, unit: true, rate: true,
          taxable: true, gstRate: true,
          cgst: true, sgst: true, igst: true, amount: true,
        },
      },
    },
  });
  if (!row) return null;

  const [client, branch, allocations, orderRow] = await Promise.all([
    db.client.findUnique({
      where: { id: row.clientId },
      select: { id: true, name: true, mobile: true, gstin: true },
    }),
    db.branch.findUnique({
      where: { id: row.branchId },
      select: { name: true, stateCode: true },
    }),
    db.receiptAllocation.findMany({
      where: { invoiceId: row.id },
      select: { id: true, receiptId: true, amount: true,
                receipt: { select: { date: true } } },
    }),
    row.orderId
      ? db.order.findUnique({ where: { id: row.orderId }, select: { number: true } })
      : Promise.resolve(null),
  ]);

  const paidTotal   = allocations.reduce((s, a) => s + a.amount, 0n);
  const outstanding = computeOutstanding(row.total, row.advanceAdjusted, paidTotal);

  return {
    id: row.id, number: row.number, type: row.type, status: row.status,
    irnStatus: row.irnStatus, irn: row.irn, ackNo: row.ackNo, ackDate: row.ackDate,
    clientId: row.clientId,
    clientName: client?.name ?? "—", clientMobile: client?.mobile ?? "", clientGstin: client?.gstin ?? null,
    branchId: row.branchId, branchName: branch?.name ?? "—", supplierStateCode: branch?.stateCode ?? "33",
    placeOfSupplyCode: row.placeOfSupplyCode,
    date: row.date, dueDate: row.dueDate,
    cancelledAt: row.cancelledAt, cancelReason: row.cancelReason,
    taxableAmount: row.taxableAmount, cgst: row.cgst, sgst: row.sgst, igst: row.igst,
    roundOff: row.roundOff, total: row.total, advanceAdjusted: row.advanceAdjusted,
    paidTotal, outstanding,
    orderId: row.orderId, orderNumber: orderRow?.number ?? null,
    projectId: row.projectId,
    lines: row.lines.map((l) => ({
      id: l.id, lineNo: l.lineNo, orderLineId: l.orderLineId,
      description: l.description, hsn: l.hsn,
      quantity: l.quantity.toString(), unit: l.unit, rate: l.rate,
      taxable: l.taxable, gstRate: l.gstRate.toString(),
      cgst: l.cgst, sgst: l.sgst, igst: l.igst, amount: l.amount,
    })),
    allocations: allocations.map((a) => ({
      id: a.id, receiptId: a.receiptId, amount: a.amount, date: a.receipt.date,
    })),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListInvoicesQuery, now: Date): WhereInput {
  const where: WhereInput = {};
  if (q.search?.trim()) {
    const s = q.search.trim();
    where["OR"] = [
      { number:   { contains: s, mode: "insensitive" } },
    ];
  }
  if (q.clientId) {
    where["clientId"] = q.clientId;
  }
  if (q.status && q.status !== "ALL") {
    if (q.status === "OUTSTANDING") {
      where["status"] = { in: ["ISSUED", "PARTIALLY_PAID"] };
    } else if (q.status === "OVERDUE") {
      where["AND"] = [
        { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
        { dueDate: { lt: now } },
      ];
    } else {
      where["status"] = q.status;
    }
  }
  return where;
}

function orderFor(sort: ListInvoicesQuery["sort"]): Record<string, "asc" | "desc"> {
  switch (sort) {
    case "oldest":  return { date: "asc" };
    case "total":   return { total: "desc" };
    case "duesoon": return { dueDate: "asc" };
    default:        return { date: "desc" };
  }
}
