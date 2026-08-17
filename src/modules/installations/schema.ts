// Zod schemas for the installations console.

import { z } from "zod";

// Must mirror the Prisma SnagStatus enum exactly. It previously listed
// "VERIFIED", which does not exist in the enum — setting it would have thrown
// at the database. @ts-nocheck on the action file hid the mismatch.
export const SNAG_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
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
