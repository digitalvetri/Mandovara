// Zod schemas for the inventory module.

import { z } from "zod";

export const ADJUSTMENT_REASONS = [
  "DAMAGE", "THEFT", "COUNT_CORRECTION", "EXPIRY", "REPACK", "OTHER",
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

// A single adjustment line. `quantity` is SIGNED — positive = stock IN,
// negative = stock OUT. UI presents it as separate IN/OUT toggle for clarity.
export const postAdjustmentSchema = z.object({
  productId:    z.string().min(1, "Pick a product"),
  warehouseId:  z.string().min(1, "Pick a warehouse"),
  direction:    z.enum(["IN", "OUT"]),
  quantity:     z.number().positive("Quantity must be > 0"),
  reason:       z.enum(ADJUSTMENT_REASONS),
  rate:         z.string().trim().min(1, "Rate is required"),
  note:         z.string().trim().max(500).optional().or(z.literal("")),
  adjustedAt:   z.string(),
  overrideNegative: z.boolean().optional(),
});

export type PostAdjustmentInput = z.infer<typeof postAdjustmentSchema>;
