import { z } from "zod";

export const PAYMENT_MODES = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CARD"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const CHEQUE_STATUSES = ["PENDING", "CLEARED", "BOUNCED"] as const;
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD");

export const receiptAllocationInput = z.object({
  invoiceId: z.string().min(1),
  amount:    z.string().regex(/^\d+$/, "Amount must be positive paise integer"),
});

export const createReceiptSchema = z.object({
  clientId:    z.string().min(1, "Pick a client"),
  projectId:   z.string().min(1).optional(),
  branchId:    z.string().min(1, "Pick a branch"),  // used for number prefix only, not stored
  date:        isoDate,
  mode:        z.enum(PAYMENT_MODES),
  reference:   z.string().trim().max(80).optional().or(z.literal("")),
  chequeDate:  isoDate.optional(),
  amount:      z.string().regex(/^\d+$/, "Amount must be positive paise integer"),
  allocations: z.array(receiptAllocationInput).default([]),
});

export const bounceReceiptSchema = z.object({
  id: z.string().min(1),
});

export const clearChequeSchema = z.object({
  id: z.string().min(1),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;
export type BounceReceiptInput = z.infer<typeof bounceReceiptSchema>;
export type ClearChequeInput   = z.infer<typeof clearChequeSchema>;
