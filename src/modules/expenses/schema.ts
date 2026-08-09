import { z } from "zod";

export const EXPENSE_HEADS = [
  "TRANSPORT", "LABOUR", "SITE_MISC", "SCAFFOLD", "FOOD", "OTHER",
] as const;
export type ExpenseHead = (typeof EXPENSE_HEADS)[number];

export const APPROVAL_STATES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD");

export const createProjectExpenseSchema = z.object({
  projectId:   z.string().cuid("projectId required"),
  head:        z.enum(EXPENSE_HEADS),
  description: z.string().trim().min(3).max(300),
  amount:      z.string().regex(/^\d+$/, "Amount must be positive paise integer"),
  incurredAt:  isoDate,
  billKey:     z.string().max(500).optional(),
});

export const approveExpenseSchema = z.object({
  id:    z.string().cuid(),
  state: z.enum(["APPROVED", "REJECTED"]),
  note:  z.string().max(300).optional(),
});

export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;
