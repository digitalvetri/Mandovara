// Zod schemas for the architect module.

import { z } from "zod";

export const createArchitectSchema = z.object({
  code:          z.string().trim().min(1, "Code required").max(40),
  firmName:      z.string().trim().min(1, "Firm name required").max(200),
  contactName:   z.string().trim().min(1, "Contact name required").max(120),
  mobile:        z.string().trim().min(1, "Mobile required").max(20),
  email:         z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  commissionPct: z.number().min(0, "≥ 0").max(50, "≤ 50%").default(0),
});
export type CreateArchitectInput = z.infer<typeof createArchitectSchema>;

export const updateArchitectSchema = z.object({
  id:            z.string().cuid(),
  firmName:      z.string().trim().min(1).max(200).optional(),
  contactName:   z.string().trim().min(1).max(120).optional(),
  mobile:        z.string().trim().min(1).max(20).optional(),
  email:         z.string().trim().email().optional().or(z.literal("")),
  commissionPct: z.number().min(0).max(50).optional(),
  isActive:      z.boolean().optional(),
});
export type UpdateArchitectInput = z.infer<typeof updateArchitectSchema>;

export const recordCommissionPaymentSchema = z.object({
  commissionId: z.string().cuid(),
  paymentRef:   z.string().trim().min(1, "Payment ref required (UPI / cheque no)").max(80),
  paidAt:       z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});
export type RecordCommissionPaymentInput = z.infer<typeof recordCommissionPaymentSchema>;

export const cancelCommissionSchema = z.object({
  commissionId: z.string().cuid(),
  reason:       z.string().trim().min(4, "Reason required (audit trail)").max(500),
});
export type CancelCommissionInput = z.infer<typeof cancelCommissionSchema>;
