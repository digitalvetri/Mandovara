import { z } from "zod";

export const QUOTATION_STATUSES = [
  "DRAFT", "SENT", "REVISED", "ACCEPTED", "REJECTED", "EXPIRED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const SELL_UNITS = [
  "METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT",
] as const;
export type SellUnit = (typeof SELL_UNITS)[number];

const isoDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

export const quotationLineInput = z.object({
  colourwayId:       z.string().cuid().optional(),
  serviceRateId:     z.string().cuid().optional(),
  measurementItemId: z.string().cuid().optional(),
  roomLabel:         z.string().trim().max(120).optional().or(z.literal("")),
  description:       z.string().trim().min(1, "Description required").max(500),
  quantity:          z.number().positive("Quantity must be > 0"),
  unit:              z.enum(SELL_UNITS),
  rate:              z.string().trim().min(1, "Rate is required"),
  discountPct:       z.number().min(0).max(100).optional(),
  // gstRate: authoritative from design when colourwayId is set; fallback for service/text lines
  gstRate:           z.number().min(0).max(28),
  isOptional:        z.boolean().optional(),
});

export const createQuotationSchema = z.object({
  projectId:         z.string().cuid("Pick a project"),
  clientId:          z.string().cuid().optional(),   // derived from project when omitted
  branchId:          z.string().cuid("Pick a branch"),
  date:              isoDate,
  validUntil:        isoDate,
  placeOfSupplyCode: z.string().length(2, "2-digit state code required"),
  termsText:         z.string().max(2000).optional().or(z.literal("")),
  lines:             z.array(quotationLineInput).min(1, "At least one line is required"),
});

export const setStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(QUOTATION_STATUSES),
});

export type QuotationLineInput   = z.infer<typeof quotationLineInput>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type SetStatusInput       = z.infer<typeof setStatusSchema>;
