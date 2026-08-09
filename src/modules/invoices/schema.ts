import { z } from "zod";

export const INVOICE_STATUSES = [
  "DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_TYPES = ["TAX", "PROFORMA", "CREDIT_NOTE", "DEBIT_NOTE"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const IRN_STATUSES = [
  "NOT_REQUIRED", "PENDING", "GENERATED", "FAILED", "CANCELLED",
] as const;
export type IrnStatus = (typeof IRN_STATUSES)[number];

export const SELL_UNITS = [
  "METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD");
const paiseStr = z.string().regex(/^-?\d+$/, "Must be an integer paise string");
const decStr   = z.string().regex(/^\d+(\.\d+)?$/, "Must be a decimal string");

export const invoiceLineInput = z.object({
  orderLineId: z.string().cuid().optional(),
  description: z.string().min(1).max(500),
  hsn:         z.string().min(2).max(8),
  quantity:    decStr,
  unit:        z.enum(SELL_UNITS),
  rate:        paiseStr,
  taxable:     paiseStr,
  gstRate:     decStr,
  cgst:        paiseStr,
  sgst:        paiseStr,
  igst:        paiseStr,
  amount:      paiseStr,
});

export const createInvoiceSchema = z.object({
  orderId:           z.string().cuid("orderId is required"),
  branchId:          z.string().cuid("branchId is required"),
  type:              z.enum(INVOICE_TYPES).default("TAX"),
  date:              isoDate,
  dueDate:           isoDate,
  placeOfSupplyCode: z.string().min(2).max(2),
  lines:             z.array(invoiceLineInput).min(1, "At least one line required"),
});

export const cancelInvoiceSchema = z.object({
  id:     z.string().cuid(),
  reason: z.string().trim().min(5, "Cancellation reason required (min 5 chars)").max(500),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
