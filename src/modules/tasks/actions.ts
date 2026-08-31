"use server";

// Task server actions for the owner-assigns-to-employee flow.
// The Task model already carries assignedToId + createdById; this
// module surfaces two thin actions:
//
//   assignTaskToUser — creates a Task with a picked assignee. Any
//     caller with project.update can assign; the assignee sees the
//     task on their /employee dashboard.
//   markTaskDone     — the assignee (or the creator) marks it DONE.
//
// Kept in its own module (not modules/projects) because tasks now
// have a life outside a project — an owner can fire a standalone
// task at an employee without going through a project first.

import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { assignTaskSchema, markTaskDoneSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok:            boolean;
  data?:         T;
  error?:        string;
  fieldErrors?:  Record<string, string>;
}

function zodError<T>(err: import("zod").ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".") || "unknown";
    if (!fieldErrors[path]) fieldErrors[path] = issue.message;
  }
  return { ok: false, error: err.issues[0]?.message ?? "Validation failed", fieldErrors };
}

export async function assignTaskToUser(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "project.update");

  const parsed = assignTaskSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string; number: string }>(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const assignee = await db.user.findUnique({
    where:  { id: d.assignedToUserId },
    select: { id: true },
  });
  if (!assignee) return { ok: false, error: "Assignee not found." };

  const yymm = yymmFromDate(new Date());
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "TASK",
      yymm,
      prefix: "MDV",
    });
    return tx.task.create({
      data: {
        organizationId: ctx.orgId,
        number,
        title:          d.title,
        description:    d.description?.trim() || null,
        projectId:      d.projectId ?? null,
        assignedToId:   d.assignedToUserId,
        createdById:    ctx.userId,
        priority:       d.priority,
        status:         "TODO",
        ...(d.dueDate && d.dueDate !== "" && { dueAt: new Date(d.dueDate) }),
      },
      select: { id: true, number: true },
    });
  }, { orgId: ctx.orgId });

  if (d.projectId) revalidatePath(`/projects/${d.projectId}`);
  revalidatePath("/employee");
  revalidatePath(`/admin/employees/${d.assignedToUserId}`);
  return { ok: true, data: created };
}

export async function markTaskDone(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  const parsed = markTaskDoneSchema.safeParse(input);
  if (!parsed.success) return zodError<{ id: string }>(parsed.error);
  const { id } = parsed.data;

  const db = scoped(ctx);
  const task = await db.task.findUnique({
    where:  { id },
    select: { id: true, status: true, assignedToId: true, createdById: true, projectId: true },
  });
  if (!task) return { ok: false, error: "Task not found." };
  if (task.status === "DONE") return { ok: false, error: "Task is already done." };

  // Assignee, or the person who created it, can complete. Everyone
  // else is refused — the audit trail keeps completion honest.
  const isAssignee = task.assignedToId === ctx.userId;
  const isCreator  = task.createdById === ctx.userId;
  if (!isAssignee && !isCreator) {
    return { ok: false, error: "Only the assignee or the person who created this task can mark it done." };
  }

  await db.task.update({
    where: { id },
    data:  { status: "DONE", completedAt: new Date() },
  });

  revalidatePath("/employee");
  if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
  return { ok: true, data: { id } };
}
