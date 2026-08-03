// Zod schemas for the vendors module.

import { z } from "zod";

export const VENDOR_STATUSES = ["ACTIVE", "INACTIVE", "BLACKLISTED"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const panRegex   = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const stateRegex = /^[0-9]{2}$/;
const mobileRegex = /^(\+91)?\d{10}$/;

export const createVendorSchema = z.object({
  name:         z.string().trim().min(2).max(200),
  mobile:       z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  email:        z.string().trim().email().optional().or(z.literal("")),
  gstin:        z.string().trim().regex(gstinRegex, "15-char GSTIN").optional().or(z.literal("")),
  pan:          z.string().trim().regex(panRegex,   "10-char PAN").optional().or(z.literal("")),
  stateCode:    z.string().trim().regex(stateRegex, "2-digit state code"),
  paymentTerms: z.number().int().min(0).max(365),
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  id: z.string().cuid(),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
