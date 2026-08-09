// Zod schemas for the receipts module.

import { z } from "zod";

export const PAYMENT_MODES = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CARD"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const receiptAllocationInput = z.object({
  invoiceId: z.string().cuid(),
  amount:    z.string().trim().min(1, "Amount required"),
});

export const createReceiptSchema = z.object({
  clientId:  z.string().cuid("Pick a client"),
  branchId:  z.string().cuid("Pick a branch"),
  date:      isoDate,
  mode:      z.enum(PAYMENT_MODES),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  amount:    z.string().trim().min(1, "Total receipt amount required"),
  allocations: z.array(receiptAllocationInput).min(1, "Allocate the receipt to at least one invoice"),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

// §14 Phase 6 gate — bounce a CHEQUE receipt. Releases all
// allocations and recomputes each affected invoice's status from
// the remaining allocations across OTHER receipts.
export const bounceReceiptSchema = z.object({
  receiptId: z.string().cuid(),
  reason:    z.string().trim().min(4, "Reason required (audit trail)").max(500),
});
export type BounceReceiptInput = z.infer<typeof bounceReceiptSchema>;
