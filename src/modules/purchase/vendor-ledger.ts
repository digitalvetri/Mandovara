// What we owe each vendor, and what we have already paid them.
//
// Owner instruction 2026-08-27: "'Outstanding' means the amount which
// stands out and should be collected BY us. In the purchase order module
// that should be renamed as the amount to be PAID TO the vendor. As we
// can give advance to the vendor, or pay at the final, we need a ledger
// so we know whom we need to pay, how much, and what was paid before."
//
// The old KPI was worse than badly named: `outstandingValue` summed the
// total value of every OPEN purchase order. A fully-paid PO still
// awaiting delivery counted toward it, and a delivered-but-unpaid one
// dropped off it the moment its status changed. It measured neither
// exposure nor debt.
//
// Money owed is billed minus paid, and nothing else:
//   • a VendorBill is a liability the moment it is approved
//   • a Payment OUT reduces it
//   • a Payment OUT with nothing allocated to it is an advance — money
//     already with the vendor, against work not yet billed
//
// Purchase orders are intent, not debt, so they do not appear in the
// balance. They appear as commitment, which is a different number and
// labelled as one.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

/** Bills in these states are money we owe. DRAFT is not yet a liability. */
const LIVE_BILL_STATUSES = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;

export interface VendorPayableRow {
  vendorId:   string;
  vendorName: string;
  code:       string;
  billed:     bigint;
  paid:       bigint;
  /** billed − paid. Negative means we are in advance with them. */
  payable:    bigint;
  /** Paid with nothing allocated against it — an advance on account. */
  advances:   bigint;
  /** Oldest unpaid bill, in days. Null when nothing is outstanding. */
  oldestDays: number | null;
}

export interface PayableSummary {
  totalPayable:  bigint;
  totalAdvances: bigint;
  vendorCount:   number;
  /** Value of open POs — commitment, deliberately separate from debt. */
  committed:     bigint;
  rows:          VendorPayableRow[];
}

export async function getVendorPayables(ctx: RequestContext): Promise<PayableSummary> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);

  const [vendors, bills, payments, openPOs] = await Promise.all([
    db.vendor.findMany({ select: { id: true, name: true, code: true } }),
    db.vendorBill.findMany({
      where:  { status: { in: [...LIVE_BILL_STATUSES] } },
      select: { id: true, vendorId: true, total: true, billDate: true, status: true },
    }),
    db.payment.findMany({
      where:  { direction: "OUTBOUND", vendorId: { not: null } },
      select: { id: true, vendorId: true, amount: true, unallocated: true, chequeStatus: true },
    }),
    db.purchaseOrder.findMany({
      where:  { status: { in: ["DRAFT", "SENT", "PARTIAL"] } },
      select: { totalValue: true },
    }),
  ]);

  const byVendor = new Map<string, { billed: bigint; paid: bigint; advances: bigint; oldest: Date | null }>();
  const bucket = (id: string) => {
    let b = byVendor.get(id);
    if (!b) { b = { billed: 0n, paid: 0n, advances: 0n, oldest: null }; byVendor.set(id, b); }
    return b;
  };

  for (const b of bills) {
    const v = bucket(b.vendorId);
    v.billed += b.total;
    // Ageing is driven by bills not yet fully paid — a PAID bill is not
    // waiting on anyone regardless of how old it is.
    if (b.status !== "PAID" && (v.oldest === null || b.billDate < v.oldest)) v.oldest = b.billDate;
  }
  for (const p of payments) {
    if (!p.vendorId) continue;
    // A bounced cheque never left our account. Counting it would show a
    // vendor as paid when they are still waiting.
    if (p.chequeStatus === "BOUNCED") continue;
    const v = bucket(p.vendorId);
    v.paid     += p.amount;
    v.advances += p.unallocated;
  }

  const nameById = new Map(vendors.map((v) => [v.id, v] as const));
  const now = Date.now();

  const rows: VendorPayableRow[] = [...byVendor.entries()]
    .map(([vendorId, v]) => {
      const meta = nameById.get(vendorId);
      const payable = v.billed - v.paid;
      return {
        vendorId,
        vendorName: meta?.name ?? "Unknown vendor",
        code:       meta?.code ?? "—",
        billed:     v.billed,
        paid:       v.paid,
        payable,
        advances:   v.advances,
        oldestDays: payable > 0n && v.oldest
          ? Math.floor((now - v.oldest.getTime()) / 86_400_000)
          : null,
      };
    })
    // Biggest debt first — this list exists to answer "who do I pay next".
    .sort((a, b) => (b.payable > a.payable ? 1 : b.payable < a.payable ? -1 : 0));

  const withDebt = rows.filter((r) => r.payable > 0n);

  return {
    totalPayable:  withDebt.reduce((s, r) => s + r.payable, 0n),
    totalAdvances: rows.reduce((s, r) => s + r.advances, 0n),
    vendorCount:   withDebt.length,
    committed:     openPOs.reduce((s, po) => s + po.totalValue, 0n),
    rows,
  };
}

// ── One vendor's statement ───────────────────────────────────────────

export type VendorLedgerKind = "BILL" | "PAYMENT" | "PO";

export interface VendorLedgerRow {
  id:      string;
  kind:    VendorLedgerKind;
  date:    Date;
  ref:     string;
  label:   string;
  /** What we came to owe (bills). */
  debit:   bigint;
  /** What we paid (payments out). */
  credit:  bigint;
  balance: bigint;
  note:    string | null;
}

export interface VendorLedger {
  vendorName: string;
  code:       string;
  rows:       VendorLedgerRow[];
  billed:     bigint;
  paid:       bigint;
  payable:    bigint;
  advances:   bigint;
}

export async function getVendorLedger(
  ctx:      RequestContext,
  vendorId: string,
): Promise<VendorLedger | null> {
  requirePermission(ctx, "po.view");
  const db = scoped(ctx);

  const vendor = await db.vendor.findUnique({
    where: { id: vendorId }, select: { name: true, code: true },
  });
  if (!vendor) return null;

  const [bills, payments] = await Promise.all([
    db.vendorBill.findMany({
      where:   { vendorId, status: { in: [...LIVE_BILL_STATUSES] } },
      orderBy: { billDate: "asc" },
      select:  { id: true, number: true, billDate: true, total: true, status: true, vendorInvoiceNo: true },
    }),
    db.payment.findMany({
      where:   { direction: "OUTBOUND", vendorId },
      orderBy: { date: "asc" },
      select: {
        id: true, number: true, date: true, amount: true, mode: true,
        reference: true, chequeStatus: true, unallocated: true,
      },
    }),
  ]);

  const rows: VendorLedgerRow[] = [];

  for (const b of bills) {
    rows.push({
      id: b.id, kind: "BILL", date: b.billDate, ref: b.number,
      label: "Bill received",
      debit: b.total, credit: 0n, balance: 0n,
      note: b.vendorInvoiceNo ? `their inv ${b.vendorInvoiceNo}` : b.status.toLowerCase().replace(/_/g, " "),
    });
  }
  for (const p of payments) {
    const bounced = p.chequeStatus === "BOUNCED";
    const isAdvance = p.unallocated > 0n && p.unallocated === p.amount;
    rows.push({
      id: p.id, kind: "PAYMENT", date: p.date, ref: p.number,
      label: bounced ? "Payment — cheque bounced" : isAdvance ? "Advance paid" : "Payment made",
      debit: 0n, credit: bounced ? 0n : p.amount, balance: 0n,
      note: bounced
        ? "bounced — not counted"
        : (p.reference ? `${p.mode} · ${p.reference}` : p.mode),
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0n;
  for (const r of rows) {
    running = running + r.debit - r.credit;
    r.balance = running;
  }

  const billed = bills.reduce((s, b) => s + b.total, 0n);
  const paid   = rows.reduce((s, r) => s + r.credit, 0n);

  return {
    vendorName: vendor.name,
    code:       vendor.code,
    rows,
    billed,
    paid,
    payable:  billed - paid,
    advances: payments.reduce((s, p) => s + p.unallocated, 0n),
  };
}
