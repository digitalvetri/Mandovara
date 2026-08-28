// Split out of queries.ts to stay under the §10 300-line limit.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import type { RequestContext } from "@/kernel/auth/context";
import { InvoiceDetail, ListInvoicesQuery } from "./queries";

export interface InvoiceKpis {
  taxInvoiceCount: number;
  invoicedNet: bigint;      // sum of taxable amount (excl. GST) on ACTIVE tax invoices
  invoicedGross: bigint;    // sum of total on ACTIVE tax invoices
  outstanding: bigint;      // total - advanceAdjusted - receiptAllocations, only >0
  creditNoteCount: number;
}

export async function getInvoiceKpis(ctx: RequestContext): Promise<InvoiceKpis> {
  requirePermission(ctx, "invoice.view");
  const db = scoped(ctx);

  const [taxInvoices, creditNotes, allocations] = await Promise.all([
    db.invoice.findMany({
      where:  { status: { notIn: ["CANCELLED", "DRAFT"] }, type: "TAX" },
      select: { id: true, total: true, taxableAmount: true, advanceAdjusted: true },
    }),
    db.invoice.count({ where: { type: "CREDIT_NOTE", status: { not: "CANCELLED" } } }),
    db.receiptAllocation.groupBy({
      by: ["invoiceId"],
      _sum: { amount: true },
    }),
  ]);

  const allocMap = new Map(allocations.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));

  let invoicedNet   = 0n;
  let invoicedGross = 0n;
  let outstanding   = 0n;
  for (const inv of taxInvoices) {
    invoicedNet   += inv.taxableAmount;
    invoicedGross += inv.total;
    const paid = allocMap.get(inv.id) ?? 0n;
    const rem  = computeOutstanding(inv.total, inv.advanceAdjusted, paid);
    if (rem > 0n) outstanding += rem;
  }

  return {
    taxInvoiceCount: taxInvoices.length,
    invoicedNet,
    invoicedGross,
    outstanding,
    creditNoteCount: creditNotes,
  };
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

/**
 * @param matched  Ids resolved from the search term by name — clients,
 *   projects and orders. The Invoice model carries clientId / projectId /
 *   orderId as plain columns with no Prisma relation ("flat schema"), so
 *   a nested `client: { name: ... }` filter is impossible; the caller
 *   resolves the names to ids first and passes them in here.
 */
export function buildWhere(
  q: ListInvoicesQuery,
  now: Date,
  matched?: { clientIds: string[]; projectIds: string[]; orderIds: string[] },
): WhereInput {
  const where: WhereInput = {};
  if (q.search?.trim()) {
    const s = q.search.trim();
    // Searching "Kishore" or "Veerakeralam villa" used to return nothing:
    // this matched the invoice number and nothing else, while both search
    // placeholders promised project and client. (owner, 2026-08-29)
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      ...(matched?.clientIds.length  ? [{ clientId:  { in: matched.clientIds  } }] : []),
      ...(matched?.projectIds.length ? [{ projectId: { in: matched.projectIds } }] : []),
      ...(matched?.orderIds.length   ? [{ orderId:   { in: matched.orderIds   } }] : []),
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

export function orderFor(sort: ListInvoicesQuery["sort"]): Record<string, "asc" | "desc"> {
  switch (sort) {
    case "oldest":  return { date: "asc" };
    case "total":   return { total: "desc" };
    case "duesoon": return { dueDate: "asc" };
    default:        return { date: "desc" };
  }
}
