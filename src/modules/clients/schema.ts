// Zod schemas for the clients module.

import { z } from "zod";

export const CLIENT_TYPES = [
  "HOMEOWNER", "ARCHITECT", "INTERIOR_DESIGNER",
  "BUILDER", "COMMERCIAL", "GOVERNMENT", "DEALER",
] as const;
export const CLIENT_STATUSES = ["ACTIVE", "INACTIVE", "BLACKLISTED"] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

// Loose GSTIN check (15-char alphanumeric); full checksum is validated
// server-side in @/kernel/tax when set. Empty allowed for unregistered walk-ins.
const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const panRegex   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const stateRegex = /^[0-9]{2}$/;
const mobileRegex = /^(\+91)?\d{10}$/;
const pincodeRegex = /^\d{6}$/;

const addressSchema = z.object({
  label:     z.string().trim().min(1).max(40),
  line1:     z.string().trim().min(3).max(120),
  line2:     z.string().trim().max(120).optional().or(z.literal("")),
  city:      z.string().trim().min(2).max(60),
  stateCode: z.string().trim().regex(stateRegex, "2-digit state code (e.g. 33 for TN)"),
  pincode:   z.string().trim().regex(pincodeRegex, "6-digit pincode"),
  isDefault: z.boolean().optional(),
});

export const createClientSchema = z.object({
  name:          z.string().trim().min(2, "Name is required").max(200),
  type:          z.enum(CLIENT_TYPES),
  primaryMobile: z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  primaryEmail:  z.string().trim().email("Not a valid email").optional().or(z.literal("")),
  gstin:         z.string().trim().regex(gstinRegex, "15-char GSTIN, e.g. 33ABCDE1234F1Z5").optional().or(z.literal("")),
  pan:           z.string().trim().regex(panRegex,   "10-char PAN, e.g. ABCDE1234F").optional().or(z.literal("")),
  stateCode:     z.string().trim().regex(stateRegex, "2-digit state code (e.g. 33 for TN)"),
  paymentTerms:  z.number().int().min(0).max(365),
  creditLimit:   z.string().trim().optional().or(z.literal("")),
  billingAddress: addressSchema.optional(),
});

export const updateClientSchema = createClientSchema.partial().extend({
  id: z.string().min(1),
});

export const setStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(CLIENT_STATUSES),
  reason: z.string().trim().max(500).optional(),
}).refine(
  (v) => v.status !== "BLACKLISTED" || (v.reason != null && v.reason.length > 0),
  { path: ["reason"], message: "Reason is required to blacklist a client" },
);

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type SetStatusInput    = z.infer<typeof setStatusSchema>;
