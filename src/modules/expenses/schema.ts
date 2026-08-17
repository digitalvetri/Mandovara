import { z } from "zod";

// Site-work expense heads — tied to a specific project (ProjectExpense).
export const EXPENSE_HEADS = [
  "TRANSPORT", "LABOUR", "SITE_MISC", "SCAFFOLD", "FOOD", "OTHER",
] as const;
export type ExpenseHead = (typeof EXPENSE_HEADS)[number];

// General overhead heads — not tied to any specific project.
// Broader list because these come up in the owner's daily life.
export const GENERAL_EXPENSE_HEADS = [
  "Rent", "Utilities", "Travel", "Office supplies", "Marketing",
  "Vendor payment", "Professional fees", "Repairs", "Insurance",
  "Bank charges", "Other",
] as const;
export type GeneralExpenseHead = (typeof GENERAL_EXPENSE_HEADS)[number];

export const APPROVAL_STATES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Must be YYYY-MM-DD");

export const createProjectExpenseSchema = z.object({
  projectId:   z.string().min(1, "projectId required"),
  head:        z.enum(EXPENSE_HEADS),
  description: z.string().trim().min(3).max(300),
  amount:      z.string().regex(/^\d+$/, "Amount must be positive paise integer"),
  incurredAt:  isoDate,
  billKey:     z.string().max(500).optional(),
});

/** General overhead expense — not tied to a project. Rent, Travel,
 *  Utilities, etc. Head is a free-string so users can type "Petrol
 *  Aug 17" or "Site inspection cab" if none of the presets fit. */
export const createExpenseSchema = z.object({
  head:        z.string().trim().min(1).max(60),
  subHead:     z.string().trim().max(120).optional(),
  description: z.string().trim().min(3).max(300),
  amount:      z.string().regex(/^\d+$/, "Amount must be positive paise integer"),
  incurredAt:  isoDate,
  billKey:     z.string().max(500).optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const approveExpenseSchema = z.object({
  id:    z.string().min(1),
  state: z.enum(["APPROVED", "REJECTED"]),
  note:  z.string().max(300).optional(),
});

export type CreateProjectExpenseInput = z.infer<typeof createProjectExpenseSchema>;
export type ApproveExpenseInput = z.infer<typeof approveExpenseSchema>;
