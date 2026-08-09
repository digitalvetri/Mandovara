// Zod schemas for the make module.
//
// 5a shipped createMakeJobFromOrder (mints the job).
// 5b adds the execution loop: status transitions + per-line material
// issuance + usage capture + QC.

import { z } from "zod";

export const MAKE_STATUSES = [
  "QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC", "READY", "DELIVERED",
] as const;
export type MakeJobStatus = (typeof MAKE_STATUSES)[number];

export const createMakeJobFromOrderSchema = z.object({
  orderId: z.string().cuid("orderId must be a cuid"),
});

export const advanceMakeJobStatusSchema = z.object({
  jobId: z.string().cuid("jobId must be a cuid"),
  toStatus: z.enum(MAKE_STATUSES),
  qcNote: z.string().trim().max(500).optional(),  // captured on QC → CUTTING rework
});

// Positive metres (up to 3 dp). Both fields optional so the tailor
// can update just fabric or just lining without re-typing the other.
const nonNegMetres = z.number({ error: "must be a number" })
  .nonnegative("must be ≥ 0")
  .max(10_000, "unrealistic > 10,000 m");

export const issueMaterialSchema = z.object({
  lineId:        z.string().cuid(),
  fabricIssuedM: nonNegMetres.optional(),
  liningIssuedM: nonNegMetres.optional(),
}).refine(
  (d) => d.fabricIssuedM != null || d.liningIssuedM != null,
  { message: "Provide fabricIssuedM and/or liningIssuedM" },
);

export const recordUsageSchema = z.object({
  lineId:      z.string().cuid(),
  actualUsedM: nonNegMetres,
  wastageM:    nonNegMetres.optional(),
});

export const qcLineSchema = z.object({
  lineId:  z.string().cuid(),
  passed:  z.boolean(),
  notes:   z.string().trim().max(500).optional(),
});

export type CreateMakeJobFromOrderInput = z.infer<typeof createMakeJobFromOrderSchema>;
export type AdvanceMakeJobStatusInput  = z.infer<typeof advanceMakeJobStatusSchema>;
export type IssueMaterialInput         = z.infer<typeof issueMaterialSchema>;
export type RecordUsageInput           = z.infer<typeof recordUsageSchema>;
export type QcLineInput                = z.infer<typeof qcLineSchema>;
