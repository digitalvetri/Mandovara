// Zod schemas for the projects module.

import { z } from "zod";

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MILESTONE_STATUSES = ["PENDING", "ACTIVE", "COMPLETED"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
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
  status: z.enum(PROJECT_STATUSES),
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

export type CreateProjectInput      = z.infer<typeof createProjectSchema>;
export type AddMilestoneInput       = z.infer<typeof addMilestoneSchema>;
export type AddTaskInput            = z.infer<typeof addTaskSchema>;
export type AddSiteLogInput         = z.infer<typeof addSiteLogSchema>;
