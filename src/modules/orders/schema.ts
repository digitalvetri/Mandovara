// Zod schemas for sales orders + dispatch.

import { z } from "zod";

export const ORDER_STATUSES = [
  "DRAFT", "CONFIRMED", "PARTIAL_DISPATCH", "DISPATCHED", "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const DISPATCH_STATUSES = ["DRAFT", "POSTED", "DELIVERED"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

export const convertQuotationSchema = z.object({
  quotationId: z.string().cuid(),
  deliveryBy:  z.string().optional(),
});

export const setOrderStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(ORDER_STATUSES),
});

export const dispatchLineInput = z.object({
  orderLineId: z.string().cuid(),
  quantity:    z.number().positive("Quantity must be > 0"),
});

export const createDispatchSchema = z.object({
  salesOrderId:  z.string().cuid(),
  dispatchedAt:  z.string(),
  vehicleNumber: z.string().trim().max(40).optional().or(z.literal("")),
  transporter:   z.string().trim().max(120).optional().or(z.literal("")),
  lines:         z.array(dispatchLineInput).min(1, "At least one line to dispatch"),
});

export type CreateDispatchInput   = z.infer<typeof createDispatchSchema>;
export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>;
export type SetOrderStatusInput   = z.infer<typeof setOrderStatusSchema>;
