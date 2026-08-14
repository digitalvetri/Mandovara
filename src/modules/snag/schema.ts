import { z } from "zod";

export const createSnagSchema = z.object({
  projectId: z.string().min(1),
  roomLabel: z.string().max(200).optional(),
  description: z.string().min(1).max(2000),
  assignedToId: z.string().min(1).optional(),
});

export const updateSnagStatusSchema = z.object({
  snagId: z.string().min(1),
  status: z.enum(["IN_PROGRESS", "RESOLVED", "CLOSED"]),
  resolutionNote: z.string().max(1000).optional(),
  assignedToId: z.string().min(1).optional(),
});

export const SNAG_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const SNAG_STATUS_COLORS: Record<string, string> = {
  OPEN: "text-fault",
  IN_PROGRESS: "text-heat",
  RESOLVED: "text-solid",
  CLOSED: "text-text-muted",
};
