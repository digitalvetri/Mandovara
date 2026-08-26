import { z } from "zod";
import { TASK_PRIORITIES } from "@/modules/projects/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/);

export const assignTaskSchema = z.object({
  title:             z.string().trim().min(1, "Title is required").max(200),
  description:       z.string().trim().max(1000).optional().or(z.literal("")),
  priority:          z.enum(TASK_PRIORITIES).default("NORMAL"),
  dueDate:           isoDate.optional().or(z.literal("")),
  assignedToUserId:  z.string().min(1, "Pick an assignee"),
  projectId:         z.string().min(1).optional(),
});

export const markTaskDoneSchema = z.object({
  id: z.string().min(1),
});

export type AssignTaskInput   = z.infer<typeof assignTaskSchema>;
export type MarkTaskDoneInput = z.infer<typeof markTaskDoneSchema>;
