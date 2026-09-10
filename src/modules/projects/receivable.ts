// What a project still owes, under the quotation-first flow.
//
// Owner's actual sequence (2026-09-10): quote → client agrees → the quote
// becomes the project → money arrives against the agreed figure → the tax
// invoice is raised at the end, once it has all landed.
//
// So the debt starts at the ACCEPTED QUOTATION, not at an invoice. This
// module is the one place that figure is assembled, and every screen that
// asks "how much is left on this job?" — the project header, the project
// ledger, Accounts → To Collect, the chase list, the payment sheet — reads
// it from here so they cannot disagree with each other.
//
// Counting money without double-counting it
// -----------------------------------------
// A rupee can reach a project by three routes and each is counted once:
//
//   1. Receipt.projectId = P, not yet applied to any bill → the receipt's
//      `unallocated` column, which is precisely "amount not on a bill".
//   2. ReceiptAllocation onto one of P's invoices → that allocation's slice.
//      This is how route 1 money is re-expressed once the invoice is finally
//      raised (see sweepProjectReceiptsOntoInvoice), so a receipt moving from
//      route 1 to route 2 changes nothing in the total.
//   3. Legacy `Advance` rows, which predate the receipt path. Read-only —
//      nothing writes new ones.
//
// Bounced cheques are excluded outright: bounceReceipt restores the full
// amount to `unallocated`, so counting one would credit money that never
// arrived.

import type { scoped } from "@/kernel/db/scoped";
import type { TxClient } from "@/kernel/db/transaction";
import {
  pickAgreedValue,
  computeProjectDue,
  computeProjectCredit,
  combineProjectDue,
  accumulateReceived,
  isProjectFullySettled,
} from "@/kernel/money/project-due";
import { computeOutstanding } from "@/kernel/money/outstanding";

type Db = ReturnType<typeof scoped> | TxClient;

/** Quotation states that represent a real figure put in front of the client.
 *  DRAFT and PENDING_APPROVAL are internal working documents and must never
 *  become a receivable. */
const LIVE_QUOTATION_STATUSES = ["SENT", "REVISED", "APPROVED", "ACCEPTED"] as const;

export interface ProjectReceivable {
  projectId:    string;
  projectNumber: string;
  projectName:  string;
  clientId:     string;
  stage:        string;
  /** What the client committed to — the accepted quotation, normally. */
  agreedValue:  bigint;
  /** Everything received against the project, by any of the three routes. */
  received:     bigint;
  /** What is owed: normally agreedValue − received, but never less than the
   *  unpaid balance of the project's own bills — an invoice can be raised
   *  for more than the quotation when work is added on site. */
  due:          bigint;
  /** Unpaid balance across the project's non-cancelled invoices. */
  invoiceDue:   bigint;
  /** received − agreedValue, clamped at 0. */
  credit:       bigint;
  /** True once the agreement is paid off — the gate the invoice sits behind. */
  settled:      boolean;
  /** Number + id of the quotation the agreement rests on, when there is one. */
  quotationId:     string | null;
  quotationNumber: string | null;
  /** True when that quotation is ACCEPTED, not merely sent. */
  agreementAccepted: boolean;
  /** When the debt started: quotation date, else the project's creation date.
   *  Uninvoiced work has no invoice due-date, so this is what ageing and the
   *  chase list measure from. */
  agreementDate: Date;
  /** Non-cancelled invoice total already raised on the project. */
  invoicedTotal: bigint;
  hasInvoice:    boolean;
}

export interface LoadReceivablesFilter {
  projectIds?: string[];
  clientId?:   string;
  /** Narrow to several clients — the clients list uses this so it does not
   *  pull every project in the org just to show one page of balances. */
  clientIds?:  string[];
}

/** Projects whose money we never chase — the job is dead or done. */
const CLOSED_STAGES = new Set(["CANCELLED"]);

export async function loadProjectReceivables(
  db:     Db,
  filter: LoadReceivablesFilter = {},
): Promise<ProjectReceivable[]> {
  const where: Record<string, unknown> = {};
  if (filter.projectIds) {
    if (filter.projectIds.length === 0) return [];
    where["id"] = { in: filter.projectIds };
  }
  if (filter.clientId) where["clientId"] = filter.clientId;
  if (filter.clientIds) {
    if (filter.clientIds.length === 0) return [];
    where["clientId"] = { in: filter.clientIds };
  }

  const projects = await db.project.findMany({
    where,
    select: {
      id: true, number: true, name: true, clientId: true,
      stage: true, orderValue: true, createdAt: true,
    },
  });
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  const [quotations, invoices, projectReceipts, advances] = await Promise.all([
    db.quotation.findMany({
      where:   { projectId: { in: projectIds }, status: { in: [...LIVE_QUOTATION_STATUSES] } },
      orderBy: { date: "asc" },
      select:  { id: true, number: true, projectId: true, date: true, total: true, status: true },
    }),
    db.invoice.findMany({
      where:  { projectId: { in: projectIds }, status: { not: "CANCELLED" } },
      select: { id: true, projectId: true, total: true, advanceAdjusted: true },
    }),
    // Money parked on the project itself. `unallocated` is the slice not yet
    // on any bill; the rest of the receipt is picked up via allocations below.
    // chequeStatus is NULLABLE — it is only set on cheques, so a cash or UPI
    // receipt has NULL there. A bare `{ not: "BOUNCED" }` is SQL
    // `chequeStatus <> 'BOUNCED'`, which is UNKNOWN for NULL and therefore
    // excludes every non-cheque payment: `received` would come back near
    // zero on every project, silently. Spell the null case out.
    db.receipt.findMany({
      where:  {
        projectId: { in: projectIds },
        OR: [{ chequeStatus: null }, { chequeStatus: { not: "BOUNCED" } }],
      },
      select: { id: true, projectId: true, unallocated: true },
    }),
    db.advance.findMany({
      where:  { projectId: { in: projectIds } },
      select: { projectId: true, amount: true },
    }),
  ]);

  const invoiceIds = invoices.map((i) => i.id);
  const allocations = invoiceIds.length === 0 ? [] :
    await db.receiptAllocation.findMany({
      where:  { invoiceId: { in: invoiceIds } },
      select: { invoiceId: true, receiptId: true, amount: true },
    });

  // A bounced cheque's allocations are deleted by bounceReceipt, so anything
  // still here belongs to a live receipt. Guard anyway — a cheque can bounce
  // through a path that only flags it.
  const bouncedReceiptIds = allocations.length === 0 ? new Set<string>() :
    new Set(
      (await db.receipt.findMany({
        where:  { id: { in: [...new Set(allocations.map((a) => a.receiptId))] }, chequeStatus: "BOUNCED" },
        select: { id: true },
      })).map((r) => r.id),
    );

  const invoiceProject = new Map(invoices.map((i) => [i.id, i.projectId] as const));

  const invoicedTotal = new Map<string, bigint>();
  const invoiceDue    = new Map<string, bigint>();
  const add = (m: Map<string, bigint>, key: string | null, v: bigint) => {
    if (!key) return;
    m.set(key, (m.get(key) ?? 0n) + v);
  };

  // The three buckets accumulateReceived counts, kept separate right up to
  // the moment it adds them, so the rule stays in one testable place.
  const buckets = new Map<string, {
    notOnABill: bigint[]; onThisProjectsBills: bigint[]; legacyAdvances: bigint[];
  }>();
  const bucketFor = (key: string) => {
    let b = buckets.get(key);
    if (!b) { b = { notOnABill: [], onThisProjectsBills: [], legacyAdvances: [] }; buckets.set(key, b); }
    return b;
  };

  const projectsWithInvoice = new Set<string>();
  for (const i of invoices) {
    add(invoicedTotal, i.projectId, i.total);
    if (i.projectId) projectsWithInvoice.add(i.projectId);
  }
  for (const r of projectReceipts) {
    if (r.projectId) bucketFor(r.projectId).notOnABill.push(r.unallocated);
  }
  for (const a of advances) bucketFor(a.projectId).legacyAdvances.push(a.amount);

  const allocatedByInvoice = new Map<string, bigint>();
  for (const a of allocations) {
    if (bouncedReceiptIds.has(a.receiptId)) continue;
    const pid = invoiceProject.get(a.invoiceId);
    if (pid) bucketFor(pid).onThisProjectsBills.push(a.amount);
    allocatedByInvoice.set(a.invoiceId, (allocatedByInvoice.get(a.invoiceId) ?? 0n) + a.amount);
  }

  // Per-invoice balance, rolled up per project. Normally zero — the sweep
  // puts the job's money onto the bill the moment it is raised — but an
  // invoice billing MORE than the quotation leaves a real balance here, and
  // it is the only place that balance is visible.
  for (const i of invoices) {
    add(invoiceDue, i.projectId, computeOutstanding(
      i.total, i.advanceAdjusted, allocatedByInvoice.get(i.id) ?? 0n,
    ));
  }

  // Latest live quotation per project, and the latest ACCEPTED one. Ordered
  // ascending above, so the last write wins.
  const latestQuote   = new Map<string, (typeof quotations)[number]>();
  const acceptedQuote = new Map<string, (typeof quotations)[number]>();
  for (const q of quotations) {
    if (!q.projectId) continue;
    latestQuote.set(q.projectId, q);
    if (q.status === "ACCEPTED") acceptedQuote.set(q.projectId, q);
  }

  return projects.map((p) => {
    const accepted = acceptedQuote.get(p.id) ?? null;
    const latest   = latestQuote.get(p.id) ?? null;
    const agreement = accepted ?? latest;

    const agreedValue = pickAgreedValue(
      accepted?.total ?? null,
      latest?.total   ?? null,
      p.orderValue,
    );
    const bucket  = buckets.get(p.id);
    const got     = bucket ? accumulateReceived(bucket) : 0n;
    const invDue  = invoiceDue.get(p.id) ?? 0n;
    const due     = combineProjectDue(computeProjectDue(agreedValue, got), invDue);

    return {
      projectId:     p.id,
      projectNumber: p.number,
      projectName:   p.name,
      clientId:      p.clientId,
      stage:         p.stage as string,
      agreedValue,
      received:      got,
      due,
      invoiceDue:    invDue,
      credit:        computeProjectCredit(agreedValue, got),
      settled:       isProjectFullySettled(agreedValue, got, invDue),
      quotationId:     agreement?.id ?? null,
      quotationNumber: agreement?.number ?? null,
      agreementAccepted: accepted != null,
      agreementDate: agreement?.date ?? p.createdAt,
      invoicedTotal: invoicedTotal.get(p.id) ?? 0n,
      hasInvoice:    projectsWithInvoice.has(p.id),
    };
  });
}

export async function getProjectReceivable(
  db:        Db,
  projectId: string,
): Promise<ProjectReceivable | null> {
  const [row] = await loadProjectReceivables(db, { projectIds: [projectId] });
  return row ?? null;
}

/** Projects with money still to come — including jobs whose quotation is out
 *  but not yet accepted.
 *
 *  This is the list the payment sheet offers as targets, and it is
 *  deliberately permissive: a client paying against a quotation they have not
 *  formally accepted IS the acceptance, and refusing to book that payment
 *  would recreate the very bug this module exists to remove. */
export function openReceivables(rows: ProjectReceivable[]): ProjectReceivable[] {
  return rows.filter((r) => r.due > 0n && !CLOSED_STAGES.has(r.stage));
}

/** Projects the studio can legitimately chase for money.
 *
 *  Narrower than openReceivables, and the difference matters: a quotation
 *  that has only been SENT is a proposal, not a debt. Counting those would
 *  put the whole sales pipeline into "To Collect" and tell the owner to
 *  chase people who never said yes.
 *
 *  A project with no accepted quotation still counts when it has a bill
 *  outstanding — an older job, or one billed before this flow existed. That
 *  is a real debt whatever the quotation says. */
export function chaseableReceivables(rows: ProjectReceivable[]): ProjectReceivable[] {
  return openReceivables(rows)
    .filter((r) => r.agreementAccepted || r.invoiceDue > 0n);
}
