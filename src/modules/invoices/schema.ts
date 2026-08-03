// Zod schemas for the invoicing module.

import { z } from "zod";

export const INVOICE_STATUSES = [
  "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED", "OVERDUE",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_TYPES = ["TAX", "PROFORMA", "CREDIT_NOTE", "DEBIT_NOTE"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const IRN_STATUSES = ["NOT_REQUIRED", "PENDING", "GENERATED", "FAILED", "CANCELLED"] as const;
export type IrnStatus = (typeof IRN_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const createFromOrderSchema = z.object({
  salesOrderId: z.string().cuid(),
  date:         isoDate.optional(),
  dueDate:      isoDate.optional(),
  type:         z.enum(INVOICE_TYPES).default("TAX"),
});

export const cancelInvoiceSchema = z.object({
  id:     z.string().cuid(),
  reason: z.string().trim().min(5, "Cancellation reason required").max(500),
});

export type CreateFromOrderInput = z.infer<typeof createFromOrderSchema>;
export type CancelInvoiceInput   = z.infer<typeof cancelInvoiceSchema>;
