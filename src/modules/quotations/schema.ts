// Zod schemas for the quotations module.
//
// Money on the wire: paise as string ("165000" = ₹1,650). Server parses to
// BigInt via parseINR before touching the DB. Rate and discountPct are the
// only writable numerics on a line — taxable / gst / amount are DERIVED and
// never trusted from the client (Rule 7 spirit: math lives in kernel/tax).

import { z } from "zod";

export const QUOTATION_STATUSES = [
  "DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

const isoDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

export const quotationLineInput = z.object({
  productId:   z.string().cuid("Pick a product"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  quantity:    z.number().positive("Quantity must be > 0"),
  rate:        z.string().trim().min(1, "Rate is required"),
  discountPct: z.number().min(0).max(100).optional(),
  isOptional:  z.boolean().optional(),
});

export const createQuotationSchema = z.object({
  clientId:   z.string().cuid("Pick a client"),
  branchId:   z.string().cuid("Pick a branch"),
  date:       isoDate,
  validUntil: isoDate,
  lines:      z.array(quotationLineInput).min(1, "At least one line is required"),
});

export const updateQuotationSchema = z.object({
  id:         z.string().cuid(),
  clientId:   z.string().cuid().optional(),
  date:       isoDate.optional(),
  validUntil: isoDate.optional(),
  lines:      z.array(quotationLineInput).min(1).optional(),
});

export const setStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(QUOTATION_STATUSES),
});

export type QuotationLineInput = z.infer<typeof quotationLineInput>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type SetStatusInput = z.infer<typeof setStatusSchema>;
