// Zod schemas for the products module.

import { z } from "zod";

export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE", "DISCONTINUED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// Common UOMs shipped as suggestions. Free text still allowed so a client
// can add a bespoke unit ("bundle", "roll", "trip") without a schema change.
export const COMMON_UOMS = [
  "NOS", "PCS", "KG", "GM", "LTR", "MTR", "SQFT", "CBM", "BOX", "BAG",
] as const;

// Table-driven GST slabs used across India. Kept literal for the picker;
// server-side is unrestricted (0.00–28.00) so exotic HSN codes still work.
export const GST_SLABS = ["0", "0.25", "3", "5", "12", "18", "28"] as const;

const hsnRegex = /^\d{4,8}$/;

export const createProductSchema = z.object({
  code:          z.string().trim().min(2, "Code is required").max(40),
  name:          z.string().trim().min(2, "Name is required").max(200),
  categoryName:  z.string().trim().min(2, "Category is required").max(60),
  hsn:           z.string().trim().regex(hsnRegex, "HSN is 4–8 digits"),
  uom:           z.string().trim().min(1).max(10),
  uomPrecision:  z.number().int().min(0).max(4),
  gstRate:       z.number().min(0).max(28),
  mrp:           z.string().trim().min(1, "MRP is required"),
  cost:          z.string().trim().optional().or(z.literal("")),
  reorderLevel:  z.string().trim().optional().or(z.literal("")),
  minStock:      z.string().trim().optional().or(z.literal("")),
  trackBatch:    z.boolean().optional(),
  trackSerial:   z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().min(1),
});

export const setStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(PRODUCT_STATUSES),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type SetStatusInput     = z.infer<typeof setStatusSchema>;
