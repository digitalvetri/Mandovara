import { z } from "zod";

// Order lifecycle stops at MAKE / COMPLETED now that installation was removed.
// The old READY_TO_INSTALL and INSTALLING states dropped with it.
export const ORDER_STATUSES = [
  "DRAFT", "CONFIRMED", "PROCUREMENT", "MAKE",
  "COMPLETED", "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const convertQuotationSchema = z.object({
  quotationId:       z.string().min(1),
  advanceRequired:   z.string().trim().optional().or(z.literal("")),
});

export const setOrderStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>;
export type SetOrderStatusInput   = z.infer<typeof setOrderStatusSchema>;
