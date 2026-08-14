import { z } from "zod";

export const ORDER_STATUSES = [
  "DRAFT", "CONFIRMED", "PROCUREMENT", "MAKE",
  "READY_TO_INSTALL", "INSTALLING", "COMPLETED", "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const convertQuotationSchema = z.object({
  quotationId:       z.string().min(1),
  promisedInstallAt: z.string().optional().or(z.literal("")),
  advanceRequired:   z.string().trim().optional().or(z.literal("")),
});

export const setOrderStatusSchema = z.object({
  id:     z.string().min(1),
  status: z.enum(ORDER_STATUSES),
});

export type ConvertQuotationInput = z.infer<typeof convertQuotationSchema>;
export type SetOrderStatusInput   = z.infer<typeof setOrderStatusSchema>;

export const scheduleDispatchSchema = z.object({
  orderId:            z.string().min(1),
  scheduledAt:        z.string().min(1, "Dispatch date is required"),
  vehicle:            z.string().trim().optional().or(z.literal("")),
  expectedDeliveryAt: z.string().optional().or(z.literal("")),
  notes:              z.string().trim().optional().or(z.literal("")),
  lines: z.array(z.object({
    orderLineId: z.string().min(1),
    plannedQty:  z.string().regex(/^\d+(\.\d+)?$/, "Must be a positive number"),
    roomLabel:   z.string().trim().default(""),
  })).min(1, "At least one line is required"),
});

export type ScheduleDispatchInput = z.infer<typeof scheduleDispatchSchema>;
