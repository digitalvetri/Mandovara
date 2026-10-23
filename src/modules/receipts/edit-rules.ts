// What correcting a recorded payment may change, and what follows from it.
//
// Owner request, 2026-10-24: edit a wrongly entered payment from the
// project's payment ledger. Pure — the server action applies the result,
// the tests pin the rules.
//
// The one hard limit is money already placed on a bill: a payment cannot
// be cut below what it has paid off on invoices, or those invoices would
// read as paid with money that no longer exists. To go lower, delete the
// payment and record it again.

import type { PaymentMode, ChequeStatus } from "./schema";

export interface ReceiptEditInput {
  /** New amount, paise. */
  amount:            bigint;
  mode:              PaymentMode;
  /** Sum of this receipt's invoice allocations, paise. */
  allocated:         bigint;
  previousMode:      PaymentMode;
  previousCheque:    ChequeStatus | null;
}

export type ReceiptEditPlan =
  | { ok: true; unallocated: bigint; chequeStatus: ChequeStatus | null; clearChequeDate: boolean }
  | { ok: false; error: string };

export function planReceiptEdit(i: ReceiptEditInput): ReceiptEditPlan {
  if (i.previousCheque === "BOUNCED") {
    return { ok: false, error: "This cheque bounced. Delete the payment instead of editing it." };
  }
  if (i.amount <= 0n) return { ok: false, error: "Amount must be more than zero." };
  if (i.amount < i.allocated) {
    return {
      ok: false,
      error: "This payment is already set against invoices for more than that. " +
             "Delete it and record it again to lower it.",
    };
  }

  // Cheque tracking follows the mode: becoming a cheque starts it as
  // pending; leaving cheque drops the status and date. Staying a cheque
  // keeps whatever was already recorded (pending or cleared).
  let chequeStatus: ChequeStatus | null;
  if (i.mode !== "CHEQUE") chequeStatus = null;
  else if (i.previousMode === "CHEQUE") chequeStatus = i.previousCheque ?? "PENDING";
  else chequeStatus = "PENDING";

  return {
    ok: true,
    unallocated: i.amount - i.allocated,
    chequeStatus,
    clearChequeDate: i.mode !== "CHEQUE",
  };
}
