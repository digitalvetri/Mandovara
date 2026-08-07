// Zod schemas for the leads module. Used by:
//   - src/modules/leads/actions.ts (server-side validation before any write)
//   - the client-side form (react-hook-form via @hookform/resolvers/zod)

import { z } from "zod";

export const LEAD_SOURCES = [
  "WEBSITE", "REFERRAL", "WHATSAPP", "WALK_IN", "EXHIBITION", "COLD_CALL", "OTHER",
] as const;

export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "PROPOSED", "NEGOTIATION", "WON", "LOST",
] as const;

export const OPEN_LEAD_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "PROPOSED", "NEGOTIATION",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStatus = (typeof LEAD_STATUSES)[number];

// E.164-lite: +91 followed by 10 digits, or 10 digits (auto-prefixed later).
const mobileRegex = /^(\+91)?\d{10}$/;

export const createLeadSchema = z.object({
  name:         z.string().trim().min(2, "Name is required").max(120),
  mobile:       z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  email:        z.string().trim().email("Not a valid email").optional().or(z.literal("")),
  companyName:  z.string().trim().max(200).optional().or(z.literal("")),
  source:       z.enum(LEAD_SOURCES),
  ownerId:      z.string().cuid().optional().or(z.literal("")),
  expectedValue: z.string().trim().optional().or(z.literal("")),
  requirement:  z.string().trim().max(2000).optional().or(z.literal("")),
  branchId:     z.string().cuid("Pick a branch"),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  id: z.string().cuid(),
});

export const statusChangeSchema = z
  .object({
    id:         z.string().cuid(),
    to:         z.enum(LEAD_STATUSES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.to !== "LOST" || (v.lostReason != null && v.lostReason.length > 0),
    { path: ["lostReason"], message: "Lost reason is required when moving to LOST" },
  );

export const convertLeadSchema = z.object({
  id: z.string().cuid(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;
