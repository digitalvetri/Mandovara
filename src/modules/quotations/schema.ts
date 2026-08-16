import { z } from "zod";

export const QUOTATION_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "REVISED", "ACCEPTED", "REJECTED", "EXPIRED",
] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const SELL_UNITS = [
  "METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT",
] as const;
export type SellUnit = (typeof SELL_UNITS)[number];

const isoDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

export const quotationLineInput = z.object({
  colourwayId:       z.string().min(1).optional(),
  serviceRateId:     z.string().min(1).optional(),
  measurementItemId: z.string().min(1).optional(),
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

// FIXES-01 §5.1 — a quotation is drafted against EITHER a lead
// (pre-conversion) OR a client (post-conversion). Exactly one of
// leadId/clientId must be present; the DB enforces the same with
// quotation_party_xor CHECK. projectId is only meaningful when a
// client exists, so it's optional here too.
export const createQuotationSchema = z.object({
  leadId:            z.string().min(1).optional(),
  clientId:          z.string().min(1).optional(),
  projectId:         z.string().min(1).optional(),
  branchId:          z.string().min(1, "Pick a branch"),
  date:              isoDate,
  validUntil:        isoDate,
  placeOfSupplyCode: z.string().length(2, "2-digit state code required"),
  termsText:         z.string().max(2000).optional().or(z.literal("")),
  lines:             z.array(quotationLineInput).min(1, "At least one line is required"),
}).refine(
  (d) => (d.leadId ? 1 : 0) + (d.clientId || d.projectId ? 1 : 0) === 1,
  { message: "Provide either leadId OR (clientId/projectId), not both.", path: ["leadId"] },
);

export const setStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(QUOTATION_STATUSES),
});

export type QuotationLineInput   = z.infer<typeof quotationLineInput>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type SetStatusInput       = z.infer<typeof setStatusSchema>;
