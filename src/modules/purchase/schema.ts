// Zod schemas for purchase orders + GRNs.

import { z } from "zod";

export const PO_STATUSES = [
  "DRAFT", "ISSUED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED",
] as const;
export type POStatus = (typeof PO_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const poLineInput = z.object({
  productId:   z.string().cuid("Pick a product"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  quantity:    z.number().positive("Quantity must be > 0"),
  rate:        z.string().trim().min(1, "Rate is required"),
});

export const createPOSchema = z.object({
  vendorId:     z.string().cuid("Pick a vendor"),
  branchId:     z.string().cuid("Pick a branch"),
  date:         isoDate,
  expectedDate: isoDate.optional(),
  lines:        z.array(poLineInput).min(1, "At least one line required"),
});

export const setPOStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(PO_STATUSES),
});

export const grnLineInput = z.object({
  poLineId:    z.string().cuid(),
  quantity:    z.number().positive("Quantity must be > 0"),
});

export const postGRNSchema = z.object({
  purchaseOrderId: z.string().cuid(),
  warehouseId:     z.string().cuid(),
  receivedAt:      isoDate,
  vehicleNumber:   z.string().trim().max(40).optional().or(z.literal("")),
  invoiceRef:      z.string().trim().max(80).optional().or(z.literal("")),
  lines:           z.array(grnLineInput).min(1, "Receive at least one line"),
});

export type CreatePOInput  = z.infer<typeof createPOSchema>;
export type PostGRNInput   = z.infer<typeof postGRNSchema>;
