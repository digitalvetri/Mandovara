// Zod schemas for the projects module.

import { z } from "zod";

export const PROJECT_STAGES = [
  "ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION", "ORDERED", "PROCUREMENT",
  "MAKE", "INSTALLATION", "SNAGGING", "COMPLETED", "CANCELLED",
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

// Legacy aliases — used by ProjectFilters, ProjectsTable, ProjectStatusPill, projects/page.tsx
export const PROJECT_STATUSES = PROJECT_STAGES;
export type ProjectStatus = ProjectStage;

export const MILESTONE_STATUSES = ["PENDING", "ACTIVE", "COMPLETED"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const createProjectSchema = z.object({
  name:          z.string().trim().min(2, "Name is required").max(200),
  clientId:      z.string().cuid("Pick a client"),
  branchId:      z.string().cuid("Pick a branch"),
  startDate:     isoDate,
  targetEndDate: isoDate.optional(),
  orderValue:    z.string().trim().min(1, "Order value is required"),
});

export const setProjectStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(PROJECT_STAGES),
});

export const addMilestoneSchema = z.object({
  projectId:   z.string().cuid(),
  name:        z.string().trim().min(1).max(200),
  plannedDate: isoDate,
  billingPct:  z.number().min(0).max(100),
});

export const setMilestoneStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(MILESTONE_STATUSES),
});

export const addTaskSchema = z.object({
  projectId:   z.string().cuid(),
  title:       z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  priority:    z.enum(TASK_PRIORITIES),
  dueDate:     isoDate.optional().or(z.literal("")),
});

export const setTaskStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(TASK_STATUSES),
});

export const addSiteLogSchema = z.object({
  projectId:     z.string().cuid(),
  summary:       z.string().trim().min(1).max(2000),
  weather:       z.string().trim().max(80).optional().or(z.literal("")),
  manpowerCount: z.number().int().min(0).optional(),
  loggedAt:      isoDate,
});

export const SNAG_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "VERIFIED"] as const;
export type SnagStatus = (typeof SNAG_STATUSES)[number];

export const addSnagSchema = z.object({
  projectId:   z.string().cuid(),
  location:    z.string().trim().min(1, "Where is it?").max(120),
  description: z.string().trim().min(1, "What's wrong?").max(1000),
});

export const setSnagStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(SNAG_STATUSES),
});

export const EXPENSE_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAID"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

// Common project-expense categories — used as datalist suggestions, not a hard enum.
export const EXPENSE_CATEGORIES = [
  "TRANSPORT", "LABOUR", "SITE_MISC", "SCAFFOLD", "FOOD", "TOOLS", "PERMITS",
] as const;

export const addProjectExpenseSchema = z.object({
  projectId:   z.string().cuid(),
  category:    z.string().trim().min(1, "Category is required").max(60),
  amount:      z.string().trim().min(1, "Amount is required"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  spentAt:     isoDate,
});

export const setProjectExpenseStatusSchema = z.object({
  id:     z.string().cuid(),
  status: z.enum(EXPENSE_STATUSES),
});

// ── Handover ─────────────────────────────────────────────────────
// Fixed template of handover checklist items. Every project starts from
// this list; the JSON stored on Handover.checklist records checked/note
// per item. Keys are stable — never rename in place, only add.
export const HANDOVER_CHECKLIST_TEMPLATE = [
  { key: "walkthrough",   label: "Walkthrough with client completed"    },
  { key: "snags_closed",  label: "All snags closed and verified"        },
  { key: "warranty_docs", label: "Warranty & maintenance docs handed over" },
  { key: "remotes",       label: "Remote controls handed over (motorised items)" },
  { key: "power_tested",  label: "Motorised items — power point tested" },
  { key: "samples_back",  label: "Sample books returned to library"     },
  { key: "site_clean",    label: "Site cleaned up"                      },
  { key: "final_invoice", label: "Final invoice raised"                 },
  { key: "client_sign",   label: "Client sign-off collected"            },
] as const;

// Zod shape for one item in the stored checklist JSON.
const checklistItemSchema = z.object({
  checked: z.boolean(),
  note:    z.string().trim().max(300).optional().or(z.literal("")),
});

export const saveHandoverSchema = z.object({
  projectId: z.string().cuid(),
  // Object keyed by item key — validated as a plain map so future keys
  // don't need a schema bump. Unknown keys are dropped in the action.
  checklist: z.record(z.string(), checklistItemSchema),
});

export type CreateProjectInput      = z.infer<typeof createProjectSchema>;
export type AddMilestoneInput       = z.infer<typeof addMilestoneSchema>;
export type AddTaskInput            = z.infer<typeof addTaskSchema>;
export type AddSiteLogInput         = z.infer<typeof addSiteLogSchema>;
export type AddSnagInput            = z.infer<typeof addSnagSchema>;
export type AddProjectExpenseInput  = z.infer<typeof addProjectExpenseSchema>;
export type SaveHandoverInput       = z.infer<typeof saveHandoverSchema>;
export type HandoverChecklistItem   = z.infer<typeof checklistItemSchema>;
export type HandoverChecklistKey    = (typeof HANDOVER_CHECKLIST_TEMPLATE)[number]["key"];
