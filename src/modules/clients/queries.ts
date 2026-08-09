// Clients repository. All reads through db.scoped(ctx).
// Schema reference: Client has `mobile`, `email`, `billingAddress Json`, `creditLimit BigInt`.
// No status field, no stateCode, no paymentTerms, no addresses relation.
// contacts ContactPerson[] exists with: id, name, designation, mobile, email, whatsappOptIn.
// Outstanding is COMPUTED from invoices − receipts, never stored (§11 acceptance).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ListClientsQuery {
  search?: string;
  type?: string | "ALL";
  page?: number;
  pageSize?: number;
  sort?: "recent" | "name" | "outstanding";
}

export interface ClientRow {
  id: string;
  code: string;
  name: string;
  type: string;
  mobile: string;
  email: string | null;
  gstin: string | null;
  priceTier: string;
  creditLimit: bigint;
  city: string | null;
  outstanding: bigint;
  createdAt: Date;
}

export interface ListClientsResult {
  rows: ClientRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContactRow {
  id: string;
  name: string;
  designation: string | null;
  mobile: string;
  email: string | null;
  whatsappOptIn: boolean;
}

export interface ClientDetail extends ClientRow {
  pan: string | null;
  altMobile: string | null;
  notes: string | null;
  billingAddress: Record<string, unknown> | null;
  contacts: ContactRow[];
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
        id: true, code: true, name: true, type: true,
        mobile: true, email: true, gstin: true,
        priceTier: true, creditLimit: true,
        billingAddress: true, createdAt: true,
      },
    }),
    db.client.count({ where }),
  ]);

  const clientIds = rows.map((r) => r.id);
  const outstanding = await outstandingByClient(ctx, clientIds);

  return {
    rows: rows.map((r) => {
      const addr = r.billingAddress as { city?: string } | null;
      return {
        id: r.id, code: r.code, name: r.name, type: r.type,
        mobile: r.mobile, email: r.email ?? null,
        gstin: r.gstin ?? null,
        priceTier: r.priceTier,
        creditLimit: r.creditLimit,
        city: addr?.city ?? null,
        outstanding: outstanding.get(r.id) ?? 0n,
        createdAt: r.createdAt,
      };
    }),
    total, page, pageSize,
  };
}

export async function getClient(ctx: RequestContext, id: string): Promise<ClientDetail | null> {
  requirePermission(ctx, "client.view");
  const db = scoped(ctx);
  const row = await db.client.findUnique({
    where: { id },
    select: {
      id: true, code: true, name: true, type: true, gstin: true, pan: true,
      mobile: true, altMobile: true, email: true,
      priceTier: true, creditLimit: true,
      billingAddress: true, notes: true, createdAt: true,
      contacts: {
        select: { id: true, name: true, designation: true, mobile: true, email: true, whatsappOptIn: true },
      },
    },
  });
  if (!row) return null;

  const ageing = await computeAgeing(ctx, id);
  const addr = row.billingAddress as { city?: string } | null;

  return {
    id: row.id, code: row.code, name: row.name, type: row.type,
    mobile: row.mobile, altMobile: row.altMobile ?? null,
    email: row.email ?? null, gstin: row.gstin ?? null, pan: row.pan ?? null,
    priceTier: row.priceTier, creditLimit: row.creditLimit,
    billingAddress: row.billingAddress as Record<string, unknown> | null,
    notes: row.notes ?? null,
    city: addr?.city ?? null,
    createdAt: row.createdAt,
    outstanding: ageing.total,
    contacts: row.contacts,
    ageing,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

type WhereInput = Record<string, unknown>;

function buildWhere(q: ListClientsQuery): WhereInput {
  const where: WhereInput = {};
  if (q.search && q.search.trim().length > 0) {
    const s = q.search.trim();
    where["OR"] = [
      { name:   { contains: s, mode: "insensitive" } },
      { mobile: { contains: s } },
      { email:  { contains: s, mode: "insensitive" } },
      { gstin:  { contains: s, mode: "insensitive" } },
    ];
  }
  if (q.type && q.type !== "ALL") where["type"] = q.type;
  return where;
}

function orderFor(sort: ListClientsQuery["sort"]): { [k: string]: "asc" | "desc" } {
  switch (sort) {
    case "name":        return { name: "asc" };
    case "outstanding":
    case "recent":
    default:            return { createdAt: "desc" };
  }
}

// Valid InvoiceStatus values that represent money still owed — no "OVERDUE" enum value exists.
const OPEN_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID"] as const;

async function outstandingByClient(
  ctx: RequestContext,
  clientIds: string[],
): Promise<Map<string, bigint>> {
  if (clientIds.length === 0) return new Map();
  const db = scoped(ctx);

  // Fetch open invoices for these clients
  const invoices = await db.invoice.findMany({
    where: { clientId: { in: clientIds }, status: { in: [...OPEN_INVOICE_STATUSES] } },
    select: { id: true, clientId: true, total: true, advanceAdjusted: true },
  });
  if (invoices.length === 0) return new Map();

  // Fetch receipt allocations for those invoice IDs (no direct relation on Invoice model)
  const invoiceIds = invoices.map((i) => i.id);
  const allocs = await db.receiptAllocation.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { invoiceId: true, amount: true },
  });

  const paidByInvoice = new Map<string, bigint>();
  for (const a of allocs) {
    paidByInvoice.set(a.invoiceId, (paidByInvoice.get(a.invoiceId) ?? 0n) + a.amount);
  }

  const balanceByClient = new Map<string, bigint>();
  for (const inv of invoices) {
    const paid = paidByInvoice.get(inv.id) ?? 0n;
    const balance = inv.total - inv.advanceAdjusted - paid;
    if (balance > 0n) {
      balanceByClient.set(inv.clientId, (balanceByClient.get(inv.clientId) ?? 0n) + balance);
    }
  }
  return balanceByClient;
}

async function computeAgeing(ctx: RequestContext, clientId: string): Promise<AgeingBuckets> {
  const db = scoped(ctx);
  const now = new Date();

  const invoices = await db.invoice.findMany({
    where: { clientId, status: { in: [...OPEN_INVOICE_STATUSES] } },
    select: { id: true, total: true, advanceAdjusted: true, dueDate: true },
  });
  if (invoices.length === 0) {
    return { bucket0_30: 0n, bucket31_60: 0n, bucket61_90: 0n, bucket90plus: 0n, total: 0n };
  }

  const invoiceIds = invoices.map((i) => i.id);
  const allocs = await db.receiptAllocation.findMany({
    where: { invoiceId: { in: invoiceIds } },
    select: { invoiceId: true, amount: true },
  });
  const paidByInvoice = new Map<string, bigint>();
  for (const a of allocs) {
    paidByInvoice.set(a.invoiceId, (paidByInvoice.get(a.invoiceId) ?? 0n) + a.amount);
  }

  const buckets = { bucket0_30: 0n, bucket31_60: 0n, bucket61_90: 0n, bucket90plus: 0n, total: 0n };
  for (const inv of invoices) {
    const paid = paidByInvoice.get(inv.id) ?? 0n;
    const balance = inv.total - inv.advanceAdjusted - paid;
    if (balance <= 0n) continue;
    const days = Math.max(0, Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000));
    if      (days <= 30) buckets.bucket0_30   += balance;
    else if (days <= 60) buckets.bucket31_60  += balance;
    else if (days <= 90) buckets.bucket61_90  += balance;
    else                 buckets.bucket90plus += balance;
    buckets.total += balance;
  }
  return buckets;
}
