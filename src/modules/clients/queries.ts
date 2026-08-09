// Clients repository. All reads through db.scoped(ctx).
// Outstanding is COMPUTED from invoices − receipts, never stored (§11 acceptance).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { ClientStatus, ClientType } from "./schema";

export interface ListClientsQuery {
  search?: string;
  type?: ClientType | "ALL";
  status?: ClientStatus | "ACTIVE_ANY" | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "name" | "outstanding";
}

export interface ClientRow {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryMobile: string;
  primaryEmail: string | null;
  gstin: string | null;
  stateCode: string;
  paymentTerms: number;
  city: string | null;
  creditLimit: bigint | null;
  outstanding: bigint;
  createdAt: Date;
}

export interface ListClientsResult {
  rows: ClientRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientDetail extends ClientRow {
  pan: string | null;
  architectId: string | null;
  updatedAt: Date;
  addresses: {
    id: string; label: string; line1: string; line2: string | null;
    city: string; stateCode: string; pincode: string; isDefault: boolean;
  }[];
  contacts: {
    id: string; name: string; role: string; mobile: string;
    email: string | null; isPrimary: boolean;
  }[];
  ageing: AgeingBuckets;
}

export interface AgeingBuckets {
  bucket0_30: bigint;
  bucket31_60: bigint;
  bucket61_90: bigint;
  bucket90plus: bigint;
  total: bigint;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export async function listClients(
  ctx: RequestContext,
  q: ListClientsQuery,
): Promise<ListClientsResult> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(1, q.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where = buildWhere(q);
  const orderBy = orderFor(q.sort);

  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true, name: true, type: true, status: true,
        primaryMobile: true, primaryEmail: true, gstin: true, stateCode: true,
        paymentTerms: true, createdAt: true,
        addresses: { where: { isDefault: true }, take: 1, select: { city: true } },
        creditLimit: { select: { limitPaise: true } },
      },
    }),
    db.client.count({ where }),
  ]);

  const clientIds = rows.map((r) => r.id);
  const outstanding = await outstandingByClient(ctx, clientIds);

  return {
    rows: rows.map((r) => ({
      id: r.id, name: r.name, type: r.type, status: r.status,
      primaryMobile: r.primaryMobile, primaryEmail: r.primaryEmail,
      gstin: r.gstin, stateCode: r.stateCode, paymentTerms: r.paymentTerms,
      city: r.addresses[0]?.city ?? null,
      creditLimit: r.creditLimit?.limitPaise ?? null,
      outstanding: outstanding.get(r.id) ?? 0n,
      createdAt: r.createdAt,
    })),
    total, page, pageSize,
  };
}

export async function getClient(ctx: RequestContext, id: string): Promise<ClientDetail | null> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const row = await db.client.findUnique({
    where: { id },
    select: {
      id: true, name: true, type: true, status: true, gstin: true, pan: true,
      primaryMobile: true, primaryEmail: true, stateCode: true, paymentTerms: true,
      architectId: true,
      createdAt: true, updatedAt: true,
      creditLimit: { select: { limitPaise: true } },
      addresses: {
        orderBy: { isDefault: "desc" },
        select: { id: true, label: true, line1: true, line2: true,
                  city: true, stateCode: true, pincode: true, isDefault: true },
      },
      contacts: {
        orderBy: { isPrimary: "desc" },
        select: { id: true, name: true, role: true, mobile: true, email: true, isPrimary: true },
      },
    },
  });
  if (!row) return null;

  const ageing = await computeAgeing(ctx, id);
  const defaultCity = row.addresses.find((a) => a.isDefault)?.city ?? row.addresses[0]?.city ?? null;

  return {
    id: row.id, name: row.name, type: row.type, status: row.status,
    primaryMobile: row.primaryMobile, primaryEmail: row.primaryEmail,
    gstin: row.gstin, pan: row.pan, stateCode: row.stateCode, paymentTerms: row.paymentTerms,
    architectId: row.architectId,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    creditLimit: row.creditLimit?.limitPaise ?? null,
    outstanding: ageing.total,
    city: defaultCity,
    addresses: row.addresses,
    contacts: row.contacts,
    ageing,
  };
}

// ── helpers ──────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListClientsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:          { contains: s, mode: "insensitive" } },
      { primaryMobile: { contains: s } },
      { primaryEmail:  { contains: s, mode: "insensitive" } },
      { gstin:         { contains: s, mode: "insensitive" } },
    ];
  }
  if (q.type && q.type !== "ALL") where["type"] = q.type;
  if (q.status && q.status !== "ALL") {
    if (q.status === "ACTIVE_ANY") where["status"] = { in: ["ACTIVE", "INACTIVE"] };
    else where["status"] = q.status;
  }
  return where;
}

function orderFor(sort: ListClientsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "name":         return { name: "asc" };
    case "outstanding":  return { createdAt: "desc" }; // outstanding is derived; sort in-page if needed
    case "recent":
    default:             return { createdAt: "desc" };
  }
}

async function outstandingByClient(
  ctx: RequestContext,
  clientIds: string[],
): Promise<Map<string, bigint>> {
  if (clientIds.length === 0) return new Map();
  const db = scoped(ctx);

  const invAgg = await db.invoice.groupBy({
    by: ["clientId"],
    where: {
      clientId: { in: clientIds },
      status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
    },
    _sum: { total: true, advanceAdjusted: true },
  });
  const recAgg = await db.receiptAllocation.groupBy({
    by: ["invoiceId"],
    where: { invoice: { clientId: { in: clientIds } } },
    _sum: { amount: true },
  });

  const allocByInvoice = new Map<string, bigint>();
  for (const r of recAgg) allocByInvoice.set(r.invoiceId, r._sum.amount ?? 0n);

  const balanceByClient = new Map<string, bigint>();
  for (const i of invAgg) {
    const invoiced = i._sum.total ?? 0n;
    const advance  = i._sum.advanceAdjusted ?? 0n;
    balanceByClient.set(i.clientId, (balanceByClient.get(i.clientId) ?? 0n) + invoiced - advance);
  }
  // subtract per-invoice receipts (grouped by invoice → sum onto client)
  const invClientMap = await db.invoice.findMany({
    where: { id: { in: [...allocByInvoice.keys()] } },
    select: { id: true, clientId: true },
  });
  for (const inv of invClientMap) {
    const paid = allocByInvoice.get(inv.id) ?? 0n;
    balanceByClient.set(inv.clientId, (balanceByClient.get(inv.clientId) ?? 0n) - paid);
  }
  return balanceByClient;
}

async function computeAgeing(ctx: RequestContext, clientId: string): Promise<AgeingBuckets> {
  const db = scoped(ctx);
  const now = new Date();

  const invoices = await db.invoice.findMany({
    where: { clientId, status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    select: {
      id: true, total: true, advanceAdjusted: true, dueDate: true,
      allocations: { select: { amount: true } },
    },
  });

  const buckets = { bucket0_30: 0n, bucket31_60: 0n, bucket61_90: 0n, bucket90plus: 0n, total: 0n };
  for (const inv of invoices) {
    const paid = inv.allocations.reduce((s, a) => s + a.amount, 0n);
    const balance = inv.total - inv.advanceAdjusted - paid;
    if (balance <= 0n) continue;
    const days = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000));
    if      (days <= 30) buckets.bucket0_30    += balance;
    else if (days <= 60) buckets.bucket31_60   += balance;
    else if (days <= 90) buckets.bucket61_90   += balance;
    else                 buckets.bucket90plus  += balance;
    buckets.total += balance;
  }
  return buckets;
}
