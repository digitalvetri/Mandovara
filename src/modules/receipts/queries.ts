// Receipts repository.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListReceiptsQuery {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: "recent" | "oldest" | "amount";
}

export interface ReceiptRow {
  id: string;
  number: string;
  date: Date;
  clientId: string;
  clientName: string;
  mode: string;
  reference: string | null;
  amount: bigint;
  unallocated: bigint;
  allocationCount: number;
}

export interface ListReceiptsResult {
  rows: ReceiptRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listReceipts(
  ctx: RequestContext,
  q: ListReceiptsQuery,
): Promise<ListReceiptsResult> {
  requirePermission(ctx, "receipt.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);
  const orderBy = q.sort === "oldest" ? { date: "asc" as const }
                : q.sort === "amount" ? { amount: "desc" as const }
                :                       { createdAt: "desc" as const };

  const [rows, total] = await Promise.all([
    db.receipt.findMany({
      where, orderBy, skip, take: pageSize,
      select: {
        id: true, number: true, date: true, mode: true, reference: true,
        amount: true, unallocated: true,
        client: { select: { id: true, name: true } },
        _count: { select: { allocations: true } },
      },
    }),
    db.receipt.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id, number: r.number, date: r.date,
      clientId: r.client.id, clientName: r.client.name,
      mode: r.mode, reference: r.reference,
      amount: r.amount, unallocated: r.unallocated,
      allocationCount: r._count.allocations,
    })),
    total, page, pageSize,
  };
}

export interface ReceiptDetail extends ReceiptRow {
  branchId: string;
  branchName: string;
  createdAt: Date;
  allocations: {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    invoiceTotal: bigint;
    amount: bigint;
  }[];
}

export async function getReceipt(ctx: RequestContext, id: string): Promise<ReceiptDetail | null> {
  requirePermission(ctx, "receipt.view");
  const db = scoped(ctx);
  const row = await db.receipt.findUnique({
    where: { id },
    select: {
      id: true, number: true, date: true, mode: true, reference: true,
      amount: true, unallocated: true, branchId: true, createdAt: true,
      client: { select: { id: true, name: true } },
      allocations: {
        select: {
          id: true, amount: true,
          invoice: { select: { id: true, number: true, total: true } },
        },
      },
    },
  });
  if (!row) return null;
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: row.branchId },
    select: { name: true },
  });
  return {
    id: row.id, number: row.number, date: row.date,
    clientId: row.client.id, clientName: row.client.name,
    mode: row.mode, reference: row.reference,
    amount: row.amount, unallocated: row.unallocated,
    allocationCount: row.allocations.length,
    branchId: row.branchId, branchName: branch.name, createdAt: row.createdAt,
    allocations: row.allocations.map((a) => ({
      id: a.id, invoiceId: a.invoice.id, invoiceNumber: a.invoice.number,
      invoiceTotal: a.invoice.total, amount: a.amount,
    })),
  };
}

// ── For the record-receipt form ──────────────────────────────────

export interface ClientForReceiptOption {
  id: string; name: string; mobile: string;
}

export interface OutstandingInvoice {
  id: string;
  number: string;
  date: Date;
  dueDate: Date;
  total: bigint;
  paidTotal: bigint;
  advanceAdjusted: bigint;
  outstanding: bigint;
}

export async function listClientsWithOutstanding(ctx: RequestContext): Promise<ClientForReceiptOption[]> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const rows = await db.client.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, primaryMobile: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, mobile: r.primaryMobile }));
}

export async function listOutstandingInvoicesForClient(
  ctx: RequestContext,
  clientId: string,
): Promise<OutstandingInvoice[]> {
  requirePermission(ctx, "receipt.create");
  const db = scoped(ctx);
  const invs = await db.invoice.findMany({
    where: {
      clientId,
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    orderBy: { date: "asc" },
    select: {
      id: true, number: true, date: true, dueDate: true,
      total: true, advanceAdjusted: true,
      allocations: { select: { amount: true } },
    },
  });
  return invs
    .map((i) => {
      const paid = i.allocations.reduce((s, a) => s + a.amount, 0n);
      const outstanding = i.total - i.advanceAdjusted - paid;
      return {
        id: i.id, number: i.number, date: i.date, dueDate: i.dueDate,
        total: i.total, paidTotal: paid, advanceAdjusted: i.advanceAdjusted,
        outstanding,
      };
    })
    .filter((i) => i.outstanding > 0n);
}

// ── helpers ──────────────────────────────────────────────────────

function buildWhere(q: ListReceiptsQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { number: { contains: s, mode: "insensitive" } },
      { client: { name: { contains: s, mode: "insensitive" } } },
      { reference: { contains: s, mode: "insensitive" } },
    ];
  }
  return where;
}
