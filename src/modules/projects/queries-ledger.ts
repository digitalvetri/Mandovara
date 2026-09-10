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
// after that event. Debits are what the client owes us; credits are what
// they have given us.
//
// What counts as the debit changed on 2026-09-10, to match how the studio
// actually works. The client agrees a quotation, pays against it over the
// life of the job, and the tax invoice is raised at the END once the money
// is in. So the ACCEPTED QUOTATION is the debit — it is the moment the
// client owes the money — and the invoice that follows is a reference row
// worth zero, because it bills for a debt already on the ledger. Charging
// both would double the balance on every settled job.
//
// Projects with no accepted quotation keep the old reading: the invoice is
// the debit, because nothing else on the page says what was owed. The
// `debtSource` field says which reading a given ledger used.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { getProjectReceivable } from "./receivable";
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
  /** The agreed figure — what the debt is measured against. */
  quoted:      bigint;
  invoiced:    bigint;
  received:    bigint;
  /** agreed − received. Negative means the client is in credit. */
  balance:     bigint;
  /** Received before any invoice existed — money against the agreement. */
  advances:    bigint;
  /** Which document the debt is read from. QUOTATION on the normal flow. */
  debtSource:  "QUOTATION" | "INVOICE";
  /** True once the agreement is fully paid — the invoice gate. */
  settled:     boolean;
}

export async function getProjectLedger(
  ctx:       RequestContext,
  projectId: string,
): Promise<ProjectLedger> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const [quotations, advances, invoices] = await Promise.all([
    db.quotation.findMany({
      // Same set getProjectReceivable treats as a live agreement, so the
      // ledger's debit row and the header's agreed value cannot diverge.
      where:   { projectId, status: { in: ["SENT", "REVISED", "APPROVED", "ACCEPTED"] } },
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
      id: true, number: true, date: true, amount: true, unallocated: true,
      projectId: true,
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

  // The agreed value and the money against it, from the one module that
  // knows how to count both (see ./receivable).
  const receivable = await getProjectReceivable(db, projectId);

  // Which reading applies. A project with a live quotation owes against that
  // quotation; one with nothing but invoices — an older job, or a bill typed
  // straight in — still owes against its invoices.
  const debtSource: "QUOTATION" | "INVOICE" =
    (receivable?.agreedValue ?? 0n) > 0n && quotations.length > 0 ? "QUOTATION" : "INVOICE";

  const rows: LedgerRow[] = [];

  // The agreement the money hangs off. Exactly ONE quotation carries the
  // debit — the accepted one, or the latest sent one if none is accepted
  // yet. Every other quotation on the project is a superseded revision and
  // must stay at zero, or a job re-quoted three times would read as owing
  // three times its value.
  const agreementId =
    quotations.filter((q) => q.status === "ACCEPTED").at(-1)?.id ??
    quotations.at(-1)?.id ?? null;

  for (const q of quotations) {
    const isAgreement = q.id === agreementId;
    rows.push({
      id: q.id, kind: "QUOTATION", date: q.date,
      ref: q.number + (q.revision > 0 ? ` r${q.revision}` : ""),
      label: q.status === "ACCEPTED" ? "Quotation accepted" : "Quotation sent",
      debit: isAgreement && debtSource === "QUOTATION" ? q.total : 0n,
      credit: 0n, balance: 0n,
      note: isAgreement
        ? (q.status === "ACCEPTED" ? "the agreed amount" : "awaiting the client's word")
        : "superseded",
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
      // Zero when the quotation already carries the debt — the invoice bills
      // for money the ledger has owed since the client agreed the quote.
      // advanceAdjusted is subtracted in the fallback reading because it is
      // already-received money absorbed at invoice time; charging the gross
      // would double-count it against the credit rows.
      debit: debtSource === "QUOTATION" ? 0n : i.total - i.advanceAdjusted,
      credit: 0n, balance: 0n,
      note: debtSource === "QUOTATION"
        ? "bill for the agreed amount"
        : (i.advanceAdjusted > 0n ? "advance adjusted" : i.status.toLowerCase().replace(/_/g, " ")),
    });
  }
  for (const r of receipts) {
    // A bounced cheque is not money. It stays visible as a row so the
    // history explains the balance, but contributes nothing.
    const bounced = r.chequeStatus === "BOUNCED";

    // Credit only what landed on THIS project, and count it the same way
    // getProjectReceivable does so the running balance ties out with the
    // header: the slice allocated to this project's bills, plus — when the
    // payment was booked to this project — whatever is not on a bill yet.
    // A receipt spread across two projects therefore credits each its own
    // share and never its full value to whichever page you happen to open.
    const allocated = r.allocations.reduce((acc: bigint, a: { amount: bigint }) => acc + a.amount, 0n);
    const onAccount = r.projectId === projectId ? r.unallocated : 0n;
    const credit = bounced ? 0n : allocated + onAccount;

    const partial = credit > 0n && credit !== r.amount;
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

  const invoiced = invoices.reduce((acc, i) => acc + i.total, 0n);
  const agreed   = receivable?.agreedValue ?? 0n;
  const received = receivable?.received    ?? 0n;

  return {
    rows,
    // The agreed figure, not the sum of every revision ever sent.
    quoted:   agreed,
    invoiced,
    // Received comes from getProjectReceivable, the one place that counts
    // money arriving by all three routes. Summing the credit column instead
    // would miss a payment booked to the project through a path this query
    // does not look at, and the header and the ledger would then disagree.
    received,
    balance:  debtSource === "QUOTATION" ? agreed - received : invoiced - received,
    advances: advances.reduce((acc, a) => acc + a.amount, 0n),
    debtSource,
    settled:  receivable?.settled ?? false,
  };
}
