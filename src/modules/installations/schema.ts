// Zod schemas for the installations console.

import { z } from "zod";

export const SNAG_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "VERIFIED"] as const;
export type SnagStatus = (typeof SNAG_STATUSES)[number];

export const postSnagSchema = z.object({
  projectId:   z.string().min(1),
  location:    z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
});

export const setSnagStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(SNAG_STATUSES),
});

export type PostSnagInput      = z.infer<typeof postSnagSchema>;
export type SetSnagStatusInput = z.infer<typeof setSnagStatusSchema>;
