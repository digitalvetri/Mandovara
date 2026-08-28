// The project's money story, in the order it happened.
//
// Owner instruction 2026-08-27: "if I click payment ledger, I need to
// check the payments received and the overall quotation, and invoice
// [amounts] in the same place."
//
// The payments panel already showed balances. What it could not answer
// is the question a client actually asks on the phone — "what have I
// paid you and what is left?" — because that needs every movement in
// sequence with a running balance, not four totals.
//
// One row per event, oldest first, each carrying the balance as it stood
// after that event. Debits are what the client owes us (invoices);
// credits are what they have given us (advances, receipts). A quotation
// is neither — it is the agreement the money hangs off, so it appears as
// a reference row with no effect on the balance.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export type LedgerKind = "QUOTATION" | "ADVANCE" | "INVOICE" | "RECEIPT";

export interface LedgerRow {
  id:      string;
  kind:    LedgerKind;
  date:    Date;
  /** "MDV/INV-2608-0042" — what the operator would search for. */
  ref:     string;
  label:   string;
  /** Money the client owes as a result of this row (invoices). */
  debit:   bigint;
  /** Money the client has given us (advances, receipts). */
  credit:  bigint;
  /** Balance owed after this row. Reference rows repeat the prior value. */
  balance: bigint;
  /** Cheque / UPI reference, invoice status — whatever qualifies the row. */
  note:    string | null;
}

export interface ProjectLedger {
  rows:        LedgerRow[];
  quoted:      bigint;
  invoiced:    bigint;
  received:    bigint;
  /** invoiced − received. Negative means the client is in credit. */
  balance:     bigint;
  /** Received before any invoice existed — money on account. */
  advances:    bigint;
}

export async function getProjectLedger(
  ctx:       RequestContext,
  projectId: string,
): Promise<ProjectLedger> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const [quotations, advances, invoices] = await Promise.all([
    db.quotation.findMany({
      where:   { projectId, status: { in: ["SENT", "ACCEPTED", "REVISED"] } },
      orderBy: { date: "asc" },
      select:  { id: true, number: true, revision: true, date: true, total: true, status: true },
    }),
    db.advance.findMany({
      where:   { projectId },
      orderBy: { receivedAt: "asc" },
      select:  { id: true, amount: true, receivedAt: true, mode: true, reference: true },
    }),
    db.invoice.findMany({
      where:   { projectId, status: { not: "CANCELLED" } },
      orderBy: { date: "asc" },
      select:  { id: true, number: true, date: true, total: true, status: true, advanceAdjusted: true },
    })
  ]);

  // Receipts reach a project by TWO routes and both must be counted.
  //
  // Receipt.projectId is optional and often null — the payment sheet does
  // not set it. The authoritative link is ReceiptAllocation -> Invoice,
  // which is what getProjectMoney uses for the RECEIVED figure in the
  // right rail.
  //
  // Querying only Receipt.projectId (as this did until 2026-08-28) meant
  // the ledger reported "₹0 of ₹1,451.40 received" on a project the rail
  // simultaneously showed as fully paid — two numbers for the same money
  // on the same screen.
  //
  // ReceiptAllocation carries invoiceId but no `invoice` relation, so the
  // invoice ids are resolved above and matched here.
  const invoiceIds = invoices.map((i) => i.id);
  const receipts = await db.receipt.findMany({
    where: {
      OR: [
        { projectId },
        ...(invoiceIds.length ? [{ allocations: { some: { invoiceId: { in: invoiceIds } } } }] : []),
      ],
    },
    orderBy: { date: "asc" },
    select: {
      id: true, number: true, date: true, amount: true,
      mode: true, reference: true, chequeStatus: true,
      // Only the portion allocated to THIS project's invoices counts. A
      // receipt settling two projects must not credit its full value to
      // whichever page you happen to be looking at.
      allocations: {
        where:  { invoiceId: { in: invoiceIds } },
        select: { amount: true },
      },
    },
  });

  const rows: LedgerRow[] = [];

  for (const q of quotations) {
    rows.push({
      id: q.id, kind: "QUOTATION", date: q.date,
      ref: q.number + (q.revision > 0 ? ` r${q.revision}` : ""),
      label: q.status === "ACCEPTED" ? "Quotation accepted" : "Quotation sent",
      debit: 0n, credit: 0n, balance: 0n,
      note: null,
    });
  }
  for (const a of advances) {
    rows.push({
      id: a.id, kind: "ADVANCE", date: a.receivedAt,
      ref: "Advance", label: "Advance received",
      debit: 0n, credit: a.amount, balance: 0n,
      note: a.reference ? `${a.mode} · ${a.reference}` : a.mode,
    });
  }
  for (const i of invoices) {
    rows.push({
      id: i.id, kind: "INVOICE", date: i.date,
      ref: i.number, label: "Invoice raised",
      // advanceAdjusted is already-received money absorbed at invoice
      // time. Charging the gross would double-count it against the
      // advance credit row above.
      debit: i.total - i.advanceAdjusted, credit: 0n, balance: 0n,
      note: i.advanceAdjusted > 0n ? "advance adjusted" : i.status.toLowerCase().replace(/_/g, " "),
    });
  }
  for (const r of receipts) {
    // A bounced cheque is not money. It stays visible as a row so the
    // history explains the balance, but contributes nothing.
    const bounced = r.chequeStatus === "BOUNCED";

    // Credit only what landed on this project. A receipt allocated
    // across invoices gets its matching slice; one linked by projectId
    // with no allocations yet is money on account, so it counts whole.
    const allocated = r.allocations.reduce((acc: bigint, a: { amount: bigint }) => acc + a.amount, 0n);
    const credit = bounced ? 0n : (allocated > 0n ? allocated : r.amount);

    const partial = allocated > 0n && allocated !== r.amount;
    rows.push({
      id: r.id, kind: "RECEIPT", date: r.date,
      ref: r.number, label: bounced ? "Receipt — cheque bounced" : "Payment received",
      debit: 0n, credit, balance: 0n,
      note: bounced
        ? "bounced — not counted"
        : partial
          ? `${r.mode} · part of a larger receipt`
          : (r.reference ? `${r.mode} · ${r.reference}` : r.mode),
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0n;
  for (const row of rows) {
    running = running + row.debit - row.credit;
    row.balance = running;
  }

  const quoted   = quotations.reduce((s, q) => s + q.total, 0n);
  const invoiced = invoices.reduce((s, i) => s + i.total, 0n);
  const received = rows.reduce((s, r) => s + r.credit, 0n);

  return {
    rows,
    quoted,
    invoiced,
    received,
    balance:  invoiced - received,
    advances: advances.reduce((s, a) => s + a.amount, 0n),
  };
}
