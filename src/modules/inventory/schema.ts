// Zod schemas for the redesigned inventory module.
//
// The old @ts-nocheck adjustment schema referenced Product / Warehouse
// models that don't exist in the current schema. Rewritten against
// Colourway + StockBalance + StockMove.

import { z } from "zod";

export const ADJUSTMENT_REASONS = [
  "STOCK_TAKE",    // physical count reconciliation
  "DAMAGE",        // damaged in storage
  "THEFT",         // shrinkage
  "EXPIRY",        // aged / obsolete
  "OTHER",
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

const idField = z.string().min(20).max(64);

// Signed delta — positive INCREASES stock, negative DECREASES.
// UI presents this as an IN/OUT toggle + positive number for clarity.
export const adjustStockSchema = z.object({
  colourwayId: idField,
  dyeLot:      z.string().trim().max(80).optional().nullable(),
  delta:       z.number().refine((n) => n !== 0, "Delta cannot be zero"),
  reason:      z.enum(ADJUSTMENT_REASONS),
  ratePaise:   z.union([z.number().int().nonnegative(), z.bigint()]).optional(),
  note:        z.string().trim().max(500).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const setReorderLevelSchema = z.object({
  colourwayId: idField,
  level:       z.number().nonnegative().nullable(),
});
export type SetReorderLevelInput = z.infer<typeof setReorderLevelSchema>;
