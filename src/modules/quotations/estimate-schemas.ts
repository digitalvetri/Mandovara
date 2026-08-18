// Schemas for the free-text estimate builder. Separate file because
// estimate-actions.ts is "use server" and may only export async functions.

import { z } from "zod";
import { SELL_UNITS } from "./schema";

const idField = z.string().min(20).max(64);

/** A line written in words — no catalog product, no measurement. */
export const estimateLineSchema = z.object({
  description: z.string().trim().min(1, "Describe what you are quoting").max(500),
  quantity:    z.number().positive("Quantity must be > 0").max(100_000),
  unit:        z.enum(SELL_UNITS),
  rate:        z.string().trim().min(1, "Rate is required"),   // rupees, parsed to paise
  gstRate:     z.number().min(0).max(28),
  discountPct: z.number().min(0).max(100).default(0),
});
export type EstimateLineInput = z.infer<typeof estimateLineSchema>;

export const createEstimateSchema = z.object({
  branchId: idField,
  // Address it to someone already known…
  leadId:   idField.optional(),
  clientId: idField.optional(),
  // …or to a brand-new enquirer, who becomes a Lead. A Quotation must belong
  // to a Lead XOR a Client (DB constraint), so there is no anonymous path.
  newLead: z.object({
    name:        z.string().trim().min(2, "Name is required").max(120),
    mobile:      z.string().trim().min(6, "Mobile is required").max(20),
    email:       z.string().trim().email().max(160).optional().or(z.literal("")),
    requirement: z.string().trim().max(500).optional(),
  }).optional(),
  validForDays: z.number().int().positive().max(365).default(15),
  termsText:    z.string().trim().max(2000).optional(),
  lines:        z.array(estimateLineSchema).min(1, "Add at least one line").max(60),
}).refine(
  (d) => [d.leadId, d.clientId, d.newLead].filter(Boolean).length === 1,
  { message: "Address the estimate to exactly one of: a lead, a client, or a new enquirer.", path: ["leadId"] },
);
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;
