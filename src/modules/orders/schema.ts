import { z } from "zod";

export const ORDER_STATUSES = [
  "DRAFT", "CONFIRMED", "PROCUREMENT", "MAKE",
  "READY_TO_INSTALL", "INSTALLING", "COMPLETED", "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const convertQuotationSchema = z.object({
  quotationId:       z.string().cuid(),
  promisedInstallAt: z.string().optional().or(z.literal("")),
  advanceRequired:   z.string().trim().optional().or(z.literal("")),
});

export const setOrderStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(ORDER_STATUSES),
});

export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>;
export type SetOrderStatusInput   = z.infer<typeof setOrderStatusSchema>;
