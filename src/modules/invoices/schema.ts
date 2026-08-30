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
  orderLineId: z.string().min(1).optional(),
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
  // An invoice usually descends from a confirmed Order, and did so
  // exclusively until 2026-08-30. The owner bills straight from a
  // project against a rough estimate — no firm quotation, no order —
  // so this is optional, and projectId/clientId carry the party in that
  // case. Invoice.orderId is nullable in the schema, so an order-less
  // invoice was always storable; nothing could create one.
  orderId:           z.string().min(1).optional(),
  projectId:         z.string().min(1).optional(),
  clientId:          z.string().min(1).optional(),
  branchId:          z.string().min(1, "branchId is required"),
  type:              z.enum(INVOICE_TYPES).default("TAX"),
  date:              isoDate,
  dueDate:           isoDate,
  placeOfSupplyCode: z.string().min(2).max(2),
  lines:             z.array(invoiceLineInput).min(1, "At least one line required"),
  // Only populated when type = CREDIT_NOTE — see createCreditNote.
  creditNoteReason:  z.string().trim().min(3).max(500).optional(),
  originalInvoiceId: z.string().min(1).optional(),
}).refine(
  (v) => !!v.orderId || (!!v.projectId && !!v.clientId),
  { message: "An invoice needs either an order, or a project and client." },
);

export const cancelInvoiceSchema = z.object({
  id:     z.string().min(1),
  reason: z.string().trim().min(5, "Cancellation reason required (min 5 chars)").max(500),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
