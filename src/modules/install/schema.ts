import { z } from "zod";

export const createInstallVisitSchema = z.object({
  orderId:     z.string().min(1),
  projectId:   z.string().min(1),
  crewId:      z.string().min(1).optional(),
  scheduledAt: z.string().datetime(),
  notes:       z.string().max(500).optional(),
});

export const assignCrewSchema = z.object({
  visitId:     z.string().min(1),
  crewId:      z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});

export const startInstallSchema = z.object({
  visitId: z.string().min(1),
});

export const recordInstallLineSchema = z.object({
  installLineId: z.string().min(1),
  installedQty:  z.number().nonnegative(),
  dyeLotUsed:    z.string().max(100).optional(),
  issue:         z.string().max(1000).optional(),
});

export const completeInstallSchema = z.object({
  visitId:            z.string().min(1),
  notes:              z.string().max(1000).optional(),
  clientSignatureKey: z.string().optional(),
});

export const confirmInstallSchema = z.object({
  visitId:            z.string().min(1),
  clientSignatureKey: z.string().optional(),
  feedbackRating:     z.number().int().min(1).max(5).optional(),
});

export const closeVisitSchema = z.object({
  visitId: z.string().min(1),
});

export const rescheduleInstallVisitSchema = z.object({
  visitId:     z.string().min(1),
  scheduledAt: z.string().datetime(),
  reason:      z.string().max(500),
});

export const raiseInstallSnagSchema = z.object({
  visitId:     z.string().min(1),
  projectId:   z.string().min(1),
  description: z.string().min(1).max(2000),
  roomLabel:   z.string().max(100).optional(),
  photoKeys:   z.array(z.string()).optional(),
});

export const resolveInstallSnagSchema = z.object({
  snagId:         z.string().min(1),
  visitId:        z.string().min(1),
  resolutionNote: z.string().max(1000).optional(),
});

// ── display helpers ───────────────────────────────────────────────────────────

export const INSTALL_STATUS_LABELS: Record<string, string> = {
  SCHEDULED:          "Scheduled",
  ASSIGNED:           "Assigned",
  IN_PROGRESS:        "In Progress",
  COMPLETED:          "Completed",
  CUSTOMER_CONFIRMED: "Confirmed",
  SNAGGING:           "Snagging",
  CLOSED:             "Closed",
  PARTIAL:            "Partial",
  RESCHEDULED:        "Rescheduled",
  CANCELLED:          "Cancelled",
};

export const INSTALL_STATUS_COLORS: Record<string, string> = {
  SCHEDULED:          "text-info border-info/40 bg-info/10",
  ASSIGNED:           "text-heat border-heat/40 bg-heat/10",
  IN_PROGRESS:        "text-gold border-gold/40 bg-gold-tint",
  COMPLETED:          "text-solid border-solid/40 bg-solid/10",
  CUSTOMER_CONFIRMED: "text-solid border-solid/40 bg-solid/15",
  SNAGGING:           "text-fault border-fault/40 bg-fault/10",
  CLOSED:             "text-text-muted border-border bg-surface-2",
  PARTIAL:            "text-heat border-heat/40 bg-heat/10",
  RESCHEDULED:        "text-text-muted border-border bg-surface-2",
  CANCELLED:          "text-text-subtle border-border bg-surface",
};

// Generic advance: SCHEDULED → ASSIGNED → IN_PROGRESS → COMPLETED
// From COMPLETED: either confirmInstall (no snags) or raiseSnag (→ SNAGGING)
// From SNAGGING: confirmInstall once all snags resolved
// From CUSTOMER_CONFIRMED: closeVisit
export const INSTALL_STATUS_NEXT: Record<string, string> = {
  SCHEDULED:   "ASSIGNED",
  ASSIGNED:    "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
};

export const INSTALL_KANBAN_COLUMNS = [
  "SCHEDULED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "SNAGGING",
  "CUSTOMER_CONFIRMED",
  "CLOSED",
] as const;
