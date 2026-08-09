import { z } from "zod";

export const createMakeJobSchema = z.object({
  orderId: z.string().cuid(),
  vendorId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(),
  targetDate: z.string().datetime().optional(),
});

export const advanceMakeJobStatusSchema = z.object({
  makeJobId: z.string().cuid(),
});

export const recordFabricIssueSchema = z.object({
  makeJobLineId: z.string().cuid(),
  fabricIssuedM: z.number().positive(),
  liningIssuedM: z.number().nonnegative().optional(),
});

export const recordActualUsageSchema = z.object({
  makeJobLineId: z.string().cuid(),
  actualUsedM: z.number().nonnegative(),
  wastageM: z.number().nonnegative(),
  qcPassed: z.boolean(),
  qcNotes: z.string().max(500).optional(),
});

// Status progression: QUEUED → CUTTING → STITCHING → FINISHING → QC → READY → DELIVERED
export const MAKE_STATUS_NEXT: Record<string, string> = {
  QUEUED: "CUTTING",
  CUTTING: "STITCHING",
  STITCHING: "FINISHING",
  FINISHING: "QC",
  QC: "READY",
  READY: "DELIVERED",
};

export const MAKE_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  CUTTING: "Cutting",
  STITCHING: "Stitching",
  FINISHING: "Finishing",
  QC: "QC",
  READY: "Ready",
  DELIVERED: "Delivered",
};

export const MAKE_KANBAN_COLUMNS = [
  "QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC", "READY",
] as const;
