import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { computeOutstanding } from "@/kernel/money/outstanding";
import { loadProjectReceivables, openReceivables } from "@/modules/projects/receivable";
import type { RequestContext } from "@/kernel/auth/context";

export * from "./queries-targets";
export type { OpenProjectForReceipt } from "./queries-targets";
export * from "./queries-invoice-payments";

export interface ReceiptRow {
  id:           string;
  number:       string;
  clientId:     string;
  clientName:   string;
  date:         Date;
  mode:         string;
  reference:    string | null;
  amount:       bigint;
  /** Not yet applied to a bill. Under the quotation-first flow this is the
   *  normal state, not a problem — see `projectName`. */
  unallocated:  bigint;
  /** The job this payment was taken against, when it was booked to one. */
  projectId:    string | null;
  projectName:  string | null;
  chequeStatus: string | null;
}

export interface ReceiptAllocationRow {
  id:            string;
  invoiceId:     string;
  invoiceNumber: string;
  invoiceTotal:  bigint;
  amount:        bigint;
}

export interface ClientForReceiptOption {
  id:     string;
  name:   string;
  mobile: string;
}

export interface ReceiptDetail {
  id:           string;
  number:       string;
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  date:         Date;
  mode:         string;
  reference:    string | null;
  chequeStatus: string | null;
  chequeDate:   Date | null;
  amount:       bigint;
  unallocated:  bigint;
  projectId:    string | null;
  projectName:  string | null;
  allocations:  ReceiptAllocationRow[];
}

export interface OutstandingInvoice {
  id:              string;
  number:          string;
  date:            Date;
  dueDate:         Date;
  total:           bigint;
  paidTotal:       bigint;
  advanceAdjusted: bigint;
  outstanding:     bigint;
}

export interface ListReceiptsQuery {
  clientId?:     string;
  projectId?:    string;
  search?:       string;
  sort?:         "recent" | "oldest" | "amount";
  page?:         number;
  pageSize?:     number;
  /** Filter by payment mode (CASH | UPI | NEFT | RTGS | CHEQUE | CARD). */
  mode?:         string;
  /** Filter by cheque status (PENDING | CLEARED | BOUNCED). */
  chequeStatus?: string;
  /** Only payments that were never placed — neither on a bill nor against a
   *  job. Money sitting against a project is matched; it is waiting for the
   *  invoice that comes at the end, which is how the studio works. */
  unmatched?:    boolean;
  /** yyyy-mm — receipts dated inside that calendar month (UTC). */
  month?:        string;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE     = 100;

export async function listReceipts(
  ctx: RequestContext,
  q: ListReceiptsQuery,
): Promise<{ rows: ReceiptRow[]; total: number; page: number; pageSize: number }> {
  requirePermission(ctx, "receipt.view");
  const db       = scoped(ctx);
  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (q.clientId)     where["clientId"]     = q.clientId;
  if (q.projectId)    where["projectId"]    = q.projectId;
  if (q.mode)         where["mode"]         = q.mode;
  if (q.chequeStatus) where["chequeStatus"] = q.chequeStatus;
  if (q.unmatched)    where["AND"] = [{ unallocated: { gt: 0n } }, { projectId: null }];
  if (q.month && /^\d{4}-\d{2}$/.test(q.month)) {
    const [yy, mm] = q.month.split("-").map(Number) as [number, number];
    const start = new Date(Date.UTC(yy, mm - 1, 1));
    const end   = new Date(Date.UTC(yy, mm,     1));
    where["date"] = { gte: start, lt: end };
  }
  if (q.search?.trim()) {
    where["number"] = { contains: q.search.trim(), mode: "insensitive" };
  }
  const orderBy: Record<string, "asc" | "desc"> =
    q.sort === "oldest" ? { date: "asc" } :
    q.sort === "amount" ? { amount: "desc" } :
                          { date: "desc" };

  const [receipts, total] = await Promise.all([
    db.receipt.findMany({
      where, skip, take: pageSize, orderBy,
      select: {
        id: true, number: true, clientId: true, projectId: true, date: true,
        mode: true, reference: true, amount: true, unallocated: true, chequeStatus: true,
      },
    }),
    db.receipt.count({ where }),
  ]);

  if (receipts.length === 0) return { rows: [], total, page, pageSize };

  const clientIds  = [...new Set(receipts.map((r) => r.clientId))];
  const projectIds = [...new Set(receipts.map((r) => r.projectId).filter((v): v is string => !!v))];
  const [clients, projects] = await Promise.all([
    db.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true },
    }),
    projectIds.length === 0 ? Promise.resolve([]) : db.project.findMany({
      where: { id: { in: projectIds } },
      select: { id: true, name: true },
    }),
  ]);
  const clientMap  = new Map(clients.map((c) => [c.id, c]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const rows: ReceiptRow[] = receipts.map((r) => ({
    id: r.id, number: r.number, clientId: r.clientId,
    clientName:   clientMap.get(r.clientId)?.name ?? "—",
    date: r.date, mode: r.mode,
    reference: r.reference,
    amount: r.amount, unallocated: r.unallocated,
    projectId:   r.projectId,
    projectName: r.projectId ? (projectMap.get(r.projectId)?.name ?? null) : null,
    chequeStatus: r.chequeStatus,
  }));

  return { rows, total, page, pageSize };
}

export async function getReceipt(
  ctx: RequestContext,
  id: string,
): Promise<ReceiptDetail | null> {
  requirePermission(ctx, "receipt.view");
  const db = scoped(ctx);

  const row = await db.receipt.findUnique({
    where: { id },
    select: {
      id: true, number: true, clientId: true, projectId: true, date: true,
      mode: true, reference: true, chequeStatus: true, chequeDate: true,
      amount: true, unallocated: true,
      allocations: { select: { id: true, invoiceId: true, amount: true }, orderBy: { id: "asc" } },
    },
  });
  if (!row) return null;

  const [client, invoices, project] = await Promise.all([
    db.client.findUnique({
      where: { id: row.clientId },
      select: { id: true, name: true, mobile: true },
    }),
    db.invoice.findMany({
      where: { id: { in: row.allocations.map((a) => a.invoiceId) } },
      select: { id: true, number: true, total: true },
    }),
    row.projectId
      ? db.project.findUnique({ where: { id: row.projectId }, select: { id: true, name: true } })
      : Promise.resolve(null),
  ]);

  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

  return {
    id: row.id, number: row.number, clientId: row.clientId,
    clientName:   client?.name ?? "—",
    clientMobile: client?.mobile ?? "",
    date: row.date, mode: row.mode, reference: row.reference,
    chequeStatus: row.chequeStatus, chequeDate: row.chequeDate,
    amount: row.amount, unallocated: row.unallocated,
    projectId:   row.projectId,
    projectName: project?.name ?? null,
    allocations: row.allocations.map((a) => ({
      id: a.id, invoiceId: a.invoiceId,
      invoiceNumber: invoiceMap.get(a.invoiceId)?.number ?? a.invoiceId,
      invoiceTotal:  invoiceMap.get(a.invoiceId)?.total ?? 0n,
      amount: a.amount,
    })),
  };
}

/** Invoices that still have outstanding balance for a given client — used by the receipt form. */
export async function listOutstandingInvoicesForClient(
  ctx: RequestContext,
  clientId: string,
): Promise<OutstandingInvoice[]> {
  requirePermission(ctx, "receipt.create");
  const db = scoped(ctx);

  const invs = await db.invoice.findMany({
    where: { clientId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
    orderBy: { date: "asc" },
    select: { id: true, number: true, date: true, dueDate: true, total: true, advanceAdjusted: true },
  });
  if (invs.length === 0) return [];

  const allocationSums = await db.receiptAllocation.groupBy({
    by: ["invoiceId"],
    where: { invoiceId: { in: invs.map((i) => i.id) } },
    _sum: { amount: true },
  });
  const paidMap = new Map(allocationSums.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));

  return invs
    .map((i) => {
      const paidTotal  = paidMap.get(i.id) ?? 0n;
      const outstanding = computeOutstanding(i.total, i.advanceAdjusted, paidTotal);
      return { id: i.id, number: i.number, date: i.date, dueDate: i.dueDate,
               total: i.total, paidTotal, advanceAdjusted: i.advanceAdjusted, outstanding };
    })
    .filter((i) => i.outstanding > 0n);
}

/** Clients a payment can be recorded against — used by the receipt form.
 *
 *  Was: clients with an open INVOICE. Under the quotation-first flow that is
 *  the smaller half of the list and, on a young installation, an empty one —
 *  the studio invoices at the END of a job, so a client who has just agreed a
 *  quotation and is about to hand over an advance has no invoice at all. The
 *  picker went blank and the advance could not be recorded, which is how the
 *  money ended up entered with nothing to match it to.
 *
 *  Now: anyone who owes money on either footing — an open project balance or
 *  an open bill. */
export async function listClientsWithOutstanding(
  ctx: RequestContext,
): Promise<ClientForReceiptOption[]> {
  requirePermission(ctx, "receipt.create");
  const db = scoped(ctx);

  const [openInvoices, receivables] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
    loadProjectReceivables(db),
  ]);
  // openReceivables, not chaseableReceivables: a client paying against a
  // quotation they have not formally accepted must still be recordable —
  // the payment IS the acceptance.

  const clientIds = [...new Set([
    ...openInvoices.map((i) => i.clientId),
    ...openReceivables(receivables).map((r) => r.clientId),
  ])];
  if (clientIds.length === 0) return [];

  const clients = await db.client.findMany({
    where: { id: { in: clientIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mobile: true },
  });
  return clients;
}
