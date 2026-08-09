import { z } from "zod";

export const createInstallVisitSchema = z.object({
  projectId: z.string().cuid(),
  orderId: z.string().cuid(),
  crewId: z.string().cuid().optional(),
  scheduledAt: z.string().datetime(),
});

export const startInstallVisitSchema = z.object({
  visitId: z.string().cuid(),
});

export const recordInstallLineSchema = z.object({
  installLineId: z.string().cuid(),
  installedQty: z.number().nonnegative(),
  dyeLotUsed: z.string().max(100).optional(),
  issue: z.string().max(1000).optional(),
});

export const completeInstallVisitSchema = z.object({
  visitId: z.string().cuid(),
  notes: z.string().max(1000).optional(),
  clientSignatureKey: z.string().optional(),
});

export const rescheduleInstallVisitSchema = z.object({
  visitId: z.string().cuid(),
  scheduledAt: z.string().datetime(),
  reason: z.string().max(500),
});

export const INSTALL_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
};
