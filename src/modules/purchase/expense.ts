// The vendor-payment Expense a PO auto-creates once goods are treated as
// received — shared by receivePO() (a single full receipt), setPOStatus()
// (a PARTIAL PO that gets cancelled still owes for what arrived), and,
// historically, postGRN() reaching RECEIVED.
//
// One place rather than three copies because all three used to compute
// this differently — and two of them dropped GST from the figure
// entirely, which is the same class of bug commit d0d588d fixed for
// PurchaseOrder.totalValue.
//
// GST input-credit fields (gstRatePct/taxable/cgst/sgst/igst/vendorGstin)
// are captured here too, at creation time, so the row is picked up by
// modules/accounts/gst.ts's input-credit query without a second,
// manual data-entry pass through the expense form. Purchases are always
// intra-state in this app — calcPOTotals never produces an igst figure
// (lib/calc/vendor-bill.ts) — so igst is always written as 0.
//
// Idempotent via Expense.sourcePoId's unique constraint: a second call
// for the same PO throws Prisma P2002, which is swallowed as "already
// exists, nothing to do."

import type { TxClient } from "@/kernel/db/transaction";

export interface VendorPaymentExpenseInput {
  organizationId: string;
  branchId: string | undefined;
  poId: string;
  poNumber: string;
  vendorName: string;
  vendorGstin: string | null;
  descriptionSuffix?: string;
  /** GST-inclusive — what the vendor is owed for the value being expensed. */
  amount: bigint;
  taxable: bigint;
  cgst: bigint;
  sgst: bigint;
  igst: bigint;
}

export async function createVendorPaymentExpense(
  tx: TxClient,
  input: VendorPaymentExpenseInput,
): Promise<void> {
  if (!input.branchId) return; // no branch anywhere — silently skip, same as before

  const gstTotal = input.cgst + input.sgst + input.igst;
  // A blended rate for display/filtering — a PO can mix GST slabs across
  // lines, and Expense carries one flat gstRatePct per row. The real
  // money (cgst/sgst/igst/taxable) is exact regardless of this figure;
  // net-payable math in gst.ts never reads gstRatePct, only cgst/sgst/igst.
  const gstRatePct = input.taxable > 0n
    ? Math.round((Number(gstTotal) / Number(input.taxable)) * 100 * 100) / 100
    : 0;

  try {
    await tx.expense.create({
      data: {
        organizationId: input.organizationId,
        branchId:       input.branchId,
        head:           "Vendor payment",
        subHead:        input.vendorName,
        description:    `${input.poNumber} — ${input.vendorName}${input.descriptionSuffix ? ` (${input.descriptionSuffix})` : ""}`,
        amount:         input.amount,
        incurredAt:     new Date(),
        approvalState:  "APPROVED", // the PO already went through its own approval; skip a second loop
        paidAt:         null,        // still owes vendor — shows up in To Pay
        sourcePoId:     input.poId,
        ...(gstTotal > 0n && {
          gstRatePct,
          taxable:     input.taxable,
          cgst:        input.cgst,
          sgst:        input.sgst,
          igst:        input.igst,
          vendorGstin: input.vendorGstin,
        }),
      },
    });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") return; // already exists — the idempotency case
    throw e;
  }
}
