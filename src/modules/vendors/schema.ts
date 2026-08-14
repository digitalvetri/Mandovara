import { z } from "zod";

const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;
const mobileRegex = /^(\+91)?\d{10}$/;

export const createVendorSchema = z.object({
  name:             z.string().trim().min(2).max(200),
  mobile:           z.string().trim().regex(mobileRegex, "10-digit mobile, optionally +91-prefixed"),
  email:            z.string().trim().email().optional().or(z.literal("")),
  gstin:            z.string().trim().regex(gstinRegex, "15-char GSTIN").optional().or(z.literal("")),
  paymentTermsDays: z.number().int().min(0).max(365),
  leadTimeDays:     z.number().int().min(0).max(365),
  brandIds:         z.array(z.string()),
  rating:           z.number().int().min(1).max(5).optional().nullable(),
});

export const updateVendorSchema = createVendorSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
