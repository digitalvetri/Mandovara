import { z } from "zod";

export const createMakeJobSchema = z.object({
  orderId: z.string().min(1),
  vendorId: z.string().min(1).optional(),
  assignedToId: z.string().min(1).optional(),
  priority: z.number().int().min(0).max(2).default(0),
  targetDate: z.string().datetime().optional(),
});

export const advanceMakeJobStatusSchema = z.object({
  makeJobId: z.string().min(1),
});

export const submitQCSchema = z.object({
  makeJobId: z.string().min(1),
  passed: z.boolean(),
  defects: z.string().max(1000).optional(),
  reworkNotes: z.string().max(1000).optional(),
  checkedById: z.string().optional(),
  qcDate: z.string().datetime().optional(),
});

export const recordFabricIssueSchema = z.object({
  makeJobLineId: z.string().min(1),
  fabricIssuedM: z.number().positive(),
  liningIssuedM: z.number().nonnegative().optional(),
});

export const recordActualUsageSchema = z.object({
  makeJobLineId: z.string().min(1),
  actualUsedM: z.number().nonnegative(),
  wastageM: z.number().nonnegative(),
  qcPassed: z.boolean(),
  qcNotes: z.string().max(500).optional(),
});

// QC is handled by submitQC — not via the generic advance button.
// REWORK goes back to QC for re-inspection.
export const MAKE_STATUS_NEXT: Record<string, string> = {
  QUEUED: "CUTTING",
  CUTTING: "STITCHING",
  STITCHING: "FINISHING",
  FINISHING: "QC",
  REWORK: "QC",
  READY: "DELIVERED",
};

export const MAKE_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  CUTTING: "Cutting",
  STITCHING: "Stitching",
  FINISHING: "Finishing",
  QC: "QC",
  REWORK: "Rework",
  READY: "Ready",
  DELIVERED: "Delivered",
};

export const MAKE_STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-surface-2 text-text-muted",
  CUTTING: "bg-info/15 text-info",
  STITCHING: "bg-heat/15 text-heat",
  FINISHING: "bg-heat/15 text-heat",
  QC: "bg-gold/15 text-gold",
  REWORK: "bg-fault/15 text-fault",
  READY: "bg-solid/15 text-solid",
  DELIVERED: "bg-solid/20 text-solid",
};

export const MAKE_KANBAN_COLUMNS = [
  "QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC", "REWORK", "READY",
] as const;

export const PRIORITY_LABELS: Record<number, string> = {
  0: "Normal",
  1: "High",
  2: "Urgent",
};
