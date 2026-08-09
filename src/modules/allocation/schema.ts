// Zod schemas for the dye-lot allocation console (§0.6, Phase 4).

import { z } from "zod";

export const allocateLotSchema = z.object({
  orderLineId:      z.string().cuid(),
  batchId:          z.string().cuid(),
  quantity:         z.number().positive("Quantity must be > 0"),
  // Set true ONLY when this allocation would introduce a second dye-lot
  // to the same order line. The action verifies the assertion server-side.
  mixedLotOverride: z.boolean().default(false),
  overrideReason:   z.string().trim().max(280).optional(),
});

export const releaseAllocationSchema = z.object({
  id: z.string().cuid(),
});

export type AllocateLotInput      = z.infer<typeof allocateLotSchema>;
export type ReleaseAllocationInput = z.infer<typeof releaseAllocationSchema>;
