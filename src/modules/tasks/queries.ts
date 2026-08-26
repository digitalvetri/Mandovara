// Task read-side. Two callers today:
//   listMyOpenTasks     — powers the "My Tasks" section on /employee.
//   listTasksForUser    — powers the Assigned Tasks list on the admin
//                         employee detail page (visible to authorised
//                         users only).

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

export interface AssignedTaskRow {
  id:            string;
  number:        string;
  title:         string;
  description:   string | null;
  status:        string;
  priority:      string;
  dueAt:         Date | null;
  createdById:   string;
  createdByName: string;
  projectId:     string | null;
  projectName:   string | null;
  completedAt:   Date | null;
}

export async function listMyOpenTasks(
  ctx: RequestContext,
): Promise<AssignedTaskRow[]> {
  return listTasksForUser(ctx, ctx.userId, { openOnly: true, limit: 25 });
}

export async function listTasksForUser(
  ctx:  RequestContext,
  userId: string,
  opts: { openOnly?: boolean; limit?: number } = {},
): Promise<AssignedTaskRow[]> {
  const db = scoped(ctx);
  const rows = await db.task.findMany({
    where: {
      assignedToId: userId,
      ...(opts.openOnly ? { status: { not: "DONE" } } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
    take:    opts.limit ?? 100,
    select: {
      id: true, number: true, title: true, description: true,
      status: true, priority: true, dueAt: true, completedAt: true,
      projectId: true, createdById: true,
    },
  });

  if (rows.length === 0) return [];

  const [projects, creators] = await Promise.all([
    db.project.findMany({
      where:  { id: { in: rows.map((r) => r.projectId).filter((v): v is string => !!v) } },
      select: { id: true, name: true },
    }),
    db.user.findMany({
      where:  { id: { in: [...new Set(rows.map((r) => r.createdById))] } },
      select: { id: true, name: true },
    }),
  ]);

  const projById = new Map(projects.map((p) => [p.id, p.name] as const));
  const usrById  = new Map(creators.map((u) => [u.id, u.name] as const));

  return rows.map((r) => ({
    id:            r.id,
    number:        r.number,
    title:         r.title,
    description:   r.description,
    status:        r.status,
    priority:      r.priority,
    dueAt:         r.dueAt,
    createdById:   r.createdById,
    createdByName: usrById.get(r.createdById) ?? "—",
    projectId:     r.projectId,
    projectName:   r.projectId ? (projById.get(r.projectId) ?? null) : null,
    completedAt:   r.completedAt,
  }));
}
