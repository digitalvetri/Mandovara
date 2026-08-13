// Zod schemas for the leads module. Used by:
//   - src/modules/leads/actions.ts (server-side validation before any write)
//   - the client-side form (react-hook-form via @hookform/resolvers/zod)

import { z } from "zod";

// Must match prisma/schema.prisma enum LeadSource exactly
export const LEAD_SOURCES = [
  "WALK_IN", "PHONE", "WHATSAPP", "WEBSITE", "INSTAGRAM",
  "ARCHITECT_REFERRAL", "CLIENT_REFERRAL", "EXHIBITION", "OTHER",
] as const;

// Sources shown in the form (PDF-specified, mapped to DB enum values)
export const LEAD_SOURCE_OPTIONS: { value: typeof LEAD_SOURCES[number]; label: string }[] = [
  { value: "WEBSITE",            label: "Website" },
  { value: "WHATSAPP",           label: "WhatsApp" },
  { value: "INSTAGRAM",          label: "Instagram" },
  { value: "PHONE",              label: "Phone" },
  { value: "WALK_IN",            label: "Walk-in" },
  { value: "CLIENT_REFERRAL",    label: "Referral" },
  { value: "ARCHITECT_REFERRAL", label: "Architect" },
  { value: "OTHER",              label: "Other" },
];

export const SOURCE_LABEL: Record<string, string> = {
  WALK_IN:            "Walk-in",
  PHONE:              "Phone",
  WHATSAPP:           "WhatsApp",
  WEBSITE:            "Website",
  INSTAGRAM:          "Instagram",
  ARCHITECT_REFERRAL: "Architect",
  CLIENT_REFERRAL:    "Referral",
  EXHIBITION:         "Exhibition",
  OTHER:              "Other",
};

// Must match prisma/schema.prisma enum LeadStage exactly
export const LEAD_STATUSES = [
  "NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "VISIT_SCHEDULED",
  "MEASURED", "QUOTED", "NEGOTIATION", "WON", "LOST",
] as const;

export const OPEN_LEAD_STATUSES = [
  "NEW", "CONTACTED", "MEASUREMENT_SCHEDULED", "VISIT_SCHEDULED",
  "MEASURED", "QUOTED", "NEGOTIATION",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];
export type LeadStage  = (typeof LEAD_STATUSES)[number];

// Project type options (stored in siteAddress JSON — no DB enum needed)
export const PROJECT_TYPES = [
  "Residential", "Commercial", "Office", "Villa", "Apartment", "Renovation", "Other",
] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

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

// E.164-lite: +91 followed by 10 digits, or 10 digits (auto-prefixed later).
const mobileRegex = /^(\+91)?\d{10}$/;

export const createLeadSchema = z.object({
  // Contact
  name:          z.string().trim().min(2, "Customer name is required").max(120),
  mobile:        z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  altMobile:     z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed")
                   .optional().or(z.literal("")),
  email:         z.string().trim().email("Not a valid email").optional().or(z.literal("")),

  // Location
  city:          z.string().trim().min(1, "City is required").max(100),
  pincode:       z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit pincode")
                   .optional().or(z.literal("")),
  siteAddress:   z.string().trim().min(1, "Site address is required").max(500),

  // Project
  projectName:   z.string().trim().min(1, "Project name is required").max(200),
  projectType:   z.enum(PROJECT_TYPES, { error: "Select a project type" }),
  budgetRange:   z.enum(BUDGET_RANGES.map((r) => r.value) as [BudgetRange, ...BudgetRange[]])
                   .optional().or(z.literal("")),

  // Lead meta
  source:        z.enum(LEAD_SOURCES, { error: "Select a lead source" }),
  ownerId:       z.string().trim().min(1, "Assigned sales executive is required"),
  requirement:   z.string().trim().min(1, "Requirements field is required").max(2000),

  // Branch (used server-side for number prefix only)
  branchId:      z.string().cuid().optional().or(z.literal("")),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  id:            z.string().cuid(),
  // Allow clearing optional fields
  altMobile:     z.string().trim().optional().or(z.literal("")),
  pincode:       z.string().trim().optional().or(z.literal("")),
  budgetRange:   z.string().trim().optional().or(z.literal("")),
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

export type CreateLeadInput   = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput   = z.infer<typeof updateLeadSchema>;
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;
export type ConvertLeadInput  = z.infer<typeof convertLeadSchema>;
