// Zod schemas for the follow-ups module.

import { z } from "zod";

export const FOLLOWUP_STATUSES = ["OPEN", "COMPLETED", "SKIPPED", "OVERDUE"] as const;
export type FollowUpStatus = (typeof FOLLOWUP_STATUSES)[number];

export const FOLLOWUP_OUTCOMES = ["CONTACTED", "NO_ANSWER", "RESCHEDULED", "CONVERTED", "LOST"] as const;
export type FollowUpOutcome = (typeof FOLLOWUP_OUTCOMES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const createFollowUpSchema = z.object({
  dueAt:       isoDate,
  note:        z.string().trim().max(500).optional().or(z.literal("")),
  leadId:      z.string().cuid().optional().or(z.literal("")),
  clientId:    z.string().cuid().optional().or(z.literal("")),
  quotationId: z.string().cuid().optional().or(z.literal("")),
}).refine(
  (v) =>
    (v.leadId && v.leadId !== "") ||
    (v.clientId && v.clientId !== "") ||
    (v.quotationId && v.quotationId !== ""),
  { message: "Attach to a lead, client, or quotation" },
);

// §11 acceptance: cannot close without outcome. Enforced here at the type
// level — the caller MUST send an outcome and the server MUST have one.
export const completeFollowUpSchema = z.object({
  id:      z.string().cuid(),
  outcome: z.enum(FOLLOWUP_OUTCOMES),
  note:    z.string().trim().max(500).optional().or(z.literal("")),
});

export const rescheduleFollowUpSchema = z.object({
  id:    z.string().cuid(),
  dueAt: isoDate,
  note:  z.string().trim().max(500).optional().or(z.literal("")),
});

export type CreateFollowUpInput     = z.infer<typeof createFollowUpSchema>;
export type CompleteFollowUpInput   = z.infer<typeof completeFollowUpSchema>;
export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>;
