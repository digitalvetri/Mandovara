// Everything the studio is owed, in one list.
//
// There are exactly two ways a client can owe money, and this module is the
// only place that decides which applies:
//
//   1. A PROJECT whose quotation the client ACCEPTED and has not paid off.
//      This is the normal case. A quotation merely sent is not a debt. The studio quotes, the client agrees, the job runs,
//      money arrives against the agreement, and the tax invoice is raised at
//      the end. The debt is agreedValue − received.
//
//   2. An INVOICE that belongs to no project — a one-off bill typed straight
//      into Invoicing with nothing behind it. The debt is the invoice's own
//      outstanding balance.
//
// The two are never summed for the same money. An invoice that DOES belong to
// a project is deliberately not a row here: its project already accounts for
// the debt, and the receipts backing it were swept onto it when it was
// raised (see sweepProjectReceiptsOntoInvoice), so counting the invoice too
// would double the amount the owner is told to collect. That double count is
// what this whole change exists to remove.
//
// Ageing: an invoice has a due date. A project does not — it has the date the
// client agreed the quotation, and money is due from that day. So a project
// row ages from its agreement date. It is an assumption, stated here rather
// than buried: the studio does not put payment terms on a quotation, and a
// job agreed four months ago with nothing collected is exactly the row the
// owner needs at the top of his chase list.

import type { scoped } from "@/kernel/db/scoped";
import { computeOutstanding } from "@/kernel/money/outstanding";
import { loadProjectReceivables, chaseableReceivables } from "@/modules/projects/receivable";
import type { AgingBucket } from "./types";

type Db = ReturnType<typeof scoped>;

export interface ReceivableRow {
  /** What kind of thing is owed — a job, or a standalone bill. */
  kind:         "PROJECT" | "INVOICE";
  /** Project id or invoice id. */
  id:           string;
  /** The number an operator would search for. */
  ref:          string;
  /** What the row is about, in the owner's words. */
  label:        string;
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  projectId:    string | null;
  projectName:  string | null;
  /** Agreed value, or the invoice total. */
  total:        bigint;
  paid:         bigint;
  outstanding:  bigint;
  /** The day the money became due. */
  dueDate:      Date;
  daysOverdue:  number;
  bucketKey:    AgingBucket["key"];
  /** Project stage or invoice status — the row's own state. */
  status:       string;
  /** Where clicking the row should land. */
  href:         string;
}

export function bucketFor(daysOverdue: number): AgingBucket["key"] {
  return daysOverdue <= 0  ? "current" :
         daysOverdue <= 30 ? "d1_30"   :
         daysOverdue <= 60 ? "d31_60"  :
         daysOverdue <= 90 ? "d61_90"  :
                             "d90p";
}

/** Every open receivable, newest debt last. Callers sort and slice. */
export async function loadReceivables(
  db: Db,
  today: Date,
  filter: { clientIds?: string[] } = {},
): Promise<ReceivableRow[]> {
  const midnight = new Date(today); midnight.setHours(0, 0, 0, 0);

  const [projectRows, standaloneInvoices] = await Promise.all([
    loadProjectReceivables(db, filter.clientIds ? { clientIds: filter.clientIds } : {}),
    db.invoice.findMany({
      where:   {
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        projectId: null,
        ...(filter.clientIds ? { clientId: { in: filter.clientIds } } : {}),
      },
      orderBy: { dueDate: "asc" },
      select:  {
        id: true, number: true, date: true, dueDate: true, status: true,
        total: true, advanceAdjusted: true, clientId: true,
      },
    }),
  ]);

  // chaseable, not merely open: a quotation that has only been SENT is a
  // proposal the client has not agreed to, and putting the sales pipeline
  // into "To Collect" would tell the owner to chase people who never said
  // yes. See chaseableReceivables for the one exception.
  const open = chaseableReceivables(projectRows);

  const clientIds = [...new Set([
    ...open.map((r) => r.clientId),
    ...standaloneInvoices.map((i) => i.clientId),
  ])];
  const clients = clientIds.length === 0 ? [] :
    await db.client.findMany({
      where:  { id: { in: clientIds } },
      select: { id: true, name: true, mobile: true },
    });
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const invoiceIds = standaloneInvoices.map((i) => i.id);
  const allocSums = invoiceIds.length === 0 ? [] :
    await db.receiptAllocation.groupBy({
      by:    ["invoiceId"],
      where: { invoiceId: { in: invoiceIds } },
      _sum:  { amount: true },
    });
  const paidMap = new Map(allocSums.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));

  const daysSince = (d: Date) =>
    Math.floor((midnight.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);

  const rows: ReceivableRow[] = [];

  for (const r of open) {
    const client = clientMap.get(r.clientId);
    const days   = daysSince(r.agreementDate);
    rows.push({
      kind:         "PROJECT",
      id:           r.projectId,
      ref:          r.quotationNumber ?? r.projectNumber,
      label:        r.projectName,
      clientId:     r.clientId,
      clientName:   client?.name   ?? "—",
      clientMobile: client?.mobile ?? "",
      projectId:    r.projectId,
      projectName:  r.projectName,
      total:        r.agreedValue,
      paid:         r.received,
      outstanding:  r.due,
      dueDate:      r.agreementDate,
      daysOverdue:  Math.max(0, days),
      bucketKey:    bucketFor(days),
      status:       r.agreementAccepted ? "AGREED" : "QUOTED",
      href:         `/projects/${r.projectId}`,
    });
  }

  for (const inv of standaloneInvoices) {
    const paid = paidMap.get(inv.id) ?? 0n;
    const open = computeOutstanding(inv.total, inv.advanceAdjusted, paid);
    if (open <= 0n) continue;
    const client = clientMap.get(inv.clientId);
    const days   = daysSince(inv.dueDate);
    rows.push({
      kind:         "INVOICE",
      id:           inv.id,
      ref:          inv.number,
      label:        "Bill",
      clientId:     inv.clientId,
      clientName:   client?.name   ?? "—",
      clientMobile: client?.mobile ?? "",
      projectId:    null,
      projectName:  null,
      total:        inv.total,
      paid,
      outstanding:  open,
      dueDate:      inv.dueDate,
      daysOverdue:  Math.max(0, days),
      bucketKey:    bucketFor(days),
      status:       inv.status,
      href:         `/invoicing/${inv.id}`,
    });
  }

  rows.sort((a, b) => {
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.outstanding > a.outstanding ? 1 : b.outstanding < a.outstanding ? -1 : 0;
  });
  return rows;
}

export interface ClientReceivable {
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  /** Jobs + standalone bills making up the balance. */
  itemCount:    number;
  outstanding:  bigint;
  oldestDays:   number;
  /** The day the oldest unpaid thing became due — what the chase list ages from. */
  oldestDueDate: Date;
}

/** Roll the receivable rows up per client. */
export function byClient(rows: ReceivableRow[]): ClientReceivable[] {
  const map = new Map<string, ClientReceivable>();
  for (const r of rows) {
    const cur = map.get(r.clientId);
    if (!cur) {
      map.set(r.clientId, {
        clientId:      r.clientId,
        clientName:    r.clientName,
        clientMobile:  r.clientMobile,
        itemCount:     1,
        outstanding:   r.outstanding,
        oldestDays:    r.daysOverdue,
        oldestDueDate: r.dueDate,
      });
      continue;
    }
    cur.itemCount   += 1;
    cur.outstanding += r.outstanding;
    if (r.daysOverdue > cur.oldestDays) cur.oldestDays = r.daysOverdue;
    if (r.dueDate < cur.oldestDueDate)  cur.oldestDueDate = r.dueDate;
  }
  return [...map.values()].sort((a, b) =>
    b.outstanding > a.outstanding ? 1 : b.outstanding < a.outstanding ? -1 : 0);
}
