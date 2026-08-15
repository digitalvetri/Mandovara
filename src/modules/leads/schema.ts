// Zod schemas for the leads module. Used by:
//   - src/modules/leads/actions.ts (server-side validation before any write)
//   - the client-side form (react-hook-form via @hookform/resolvers/zod)

import { z } from "zod";

// Must match prisma/schema.prisma enum LeadSource exactly
export const LEAD_SOURCES = [
  "WALK_IN", "PHONE", "WHATSAPP", "WEBSITE", "INSTAGRAM",
  "FACEBOOK", "GOOGLE",
  "ARCHITECT_REFERRAL", "CLIENT_REFERRAL", "EXHIBITION", "ADVERTISEMENT", "OTHER",
] as const;

// Sources shown in the new-lead form (PDF-specified order, mapped to DB enum values)
export const LEAD_SOURCE_OPTIONS: { value: typeof LEAD_SOURCES[number]; label: string }[] = [
  { value: "WEBSITE",            label: "Website" },
  { value: "WHATSAPP",           label: "WhatsApp" },
  { value: "INSTAGRAM",          label: "Instagram" },
  { value: "FACEBOOK",           label: "Facebook" },
  { value: "GOOGLE",             label: "Google" },
  { value: "CLIENT_REFERRAL",    label: "Referral" },
  { value: "WALK_IN",            label: "Walk-in" },
  { value: "ADVERTISEMENT",      label: "Advertisement" },
  { value: "OTHER",              label: "Other" },
];

export const SOURCE_LABEL: Record<string, string> = {
  WALK_IN:            "Walk-in",
  PHONE:              "Phone",
  WHATSAPP:           "WhatsApp",
  WEBSITE:            "Website",
  INSTAGRAM:          "Instagram",
  FACEBOOK:           "Facebook",
  GOOGLE:             "Google",
  ARCHITECT_REFERRAL: "Architect Referral",
  CLIENT_REFERRAL:    "Referral",
  EXHIBITION:         "Exhibition",
  ADVERTISEMENT:      "Advertisement",
  OTHER:              "Other",
};

// Must match prisma/schema.prisma enum LeadStage exactly
export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "MEASUREMENT_SCHEDULED", "VISIT_SCHEDULED",
  "MEASURED", "QUOTED", "NEGOTIATION", "WON", "LOST",
] as const;

export const OPEN_LEAD_STATUSES = [
  "NEW", "CONTACTED", "QUALIFIED", "MEASUREMENT_SCHEDULED", "VISIT_SCHEDULED",
  "MEASURED", "QUOTED", "NEGOTIATION",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStage  = (typeof LEAD_STATUSES)[number];

// Lead priority — stored in siteAddress JSON (not a DB column)
export const LEAD_PRIORITIES = ["HOT", "WARM", "COLD"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_PRIORITY_OPTIONS: { value: LeadPriority; label: string; desc: string }[] = [
  { value: "HOT",  label: "Hot",  desc: "Ready to decide now" },
  { value: "WARM", label: "Warm", desc: "Interested, needs nurturing" },
  { value: "COLD", label: "Cold", desc: "Early stage, low urgency" },
];

// Predefined budget ranges (mapped to budgetMin/budgetMax paise in the action)
export const BUDGET_RANGES = [
  { value: "under-5L",   label: "Under ₹5 Lakhs" },
  { value: "5L-10L",     label: "₹5L – ₹10L" },
  { value: "10L-25L",    label: "₹10L – ₹25L" },
  { value: "25L-50L",    label: "₹25L – ₹50L" },
  { value: "50L-1Cr",    label: "₹50L – ₹1 Crore" },
  { value: "above-1Cr",  label: "Above ₹1 Crore" },
] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number]["value"];

// Project type options (stored in siteAddress JSON — no DB enum needed)
export const PROJECT_TYPES = [
  "Residential", "Commercial", "Office", "Villa", "Apartment", "Renovation", "Other",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

// E.164-lite: +91 followed by 10 digits, or 10 digits (auto-prefixed later).
const mobileRegex = /^(\+91)?\d{10}$/;

export const createLeadSchema = z.object({
  // Customer information
  name:        z.string().trim().min(2, "Customer name is required").max(120),
  mobile:      z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  altMobile:   z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed")
                 .optional().or(z.literal("")),
  email:       z.string().trim().email("Not a valid email").optional().or(z.literal("")),
  city:        z.string().trim().max(100).optional().or(z.literal("")),
  pincode:     z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode")
                 .optional().or(z.literal("")),

  // Enquiry
  requirement: z.string().trim().max(2000).optional().or(z.literal("")),
  source:      z.enum(LEAD_SOURCES, { error: "Select a lead source" }),
  priority:    z.enum(LEAD_PRIORITIES),

  // Budget (kept for EditableField on detail page)
  budgetRange: z.enum(BUDGET_RANGES.map((r) => r.value) as [BudgetRange, ...BudgetRange[]])
                 .optional().or(z.literal("")),

  // Assignment
  ownerId:     z.string().trim().optional().or(z.literal("")),

  // Branch (used server-side for number prefix only)
  branchId:    z.string().min(1).optional().or(z.literal("")),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  id:          z.string().min(1),
  altMobile:   z.string().trim().optional().or(z.literal("")),
  pincode:     z.string().trim().optional().or(z.literal("")),
  budgetRange: z.string().trim().optional().or(z.literal("")),
});

export const statusChangeSchema = z
  .object({
    id:         z.string().min(1),
    to:         z.enum(LEAD_STATUSES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => v.to !== "LOST" || (v.lostReason != null && v.lostReason.length > 0),
    { path: ["lostReason"], message: "Lost reason is required when moving to LOST" },
  );

export const convertLeadSchema = z.object({
  id: z.string().min(1),
  projectName:       z.string().trim().min(1).max(200).optional(),
  projectType:       z.string().trim().max(50).optional(),
  siteCity:          z.string().trim().max(100).optional(),
  requirement:       z.string().trim().max(2000).optional(),
  estimatedBudget:   z.string().trim().max(30).optional(),
  expectedStartDate: z.string().trim().max(10).optional(),
});

export type CreateLeadInput   = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput   = z.infer<typeof updateLeadSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type ConvertLeadInput  = z.infer<typeof convertLeadSchema>;
