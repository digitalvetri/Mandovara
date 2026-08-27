// Room read-side. Split out of queries.ts (2026-08-27) when lead-scoped
// rooms pushed that file past the 300-line ceiling.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export async function listRoomsForProject(
  ctx:       RequestContext,
  projectId: string,
): Promise<{ id: string; name: string; floorLabel: string | null; sortOrder: number }[]> {
  return listRoomsForSubject(ctx, { kind: "PROJECT", id: projectId });
}

/**
 * Rooms belonging to a project OR a lead. Rooms became lead-scopable on
 * 2026-08-27 alongside measurements — a prospect's house has rooms
 * whether or not anyone has signed anything yet.
 */
export async function listRoomsForSubject(
  ctx:     RequestContext,
  subject: { kind: "PROJECT" | "LEAD"; id: string },
): Promise<{ id: string; name: string; floorLabel: string | null; sortOrder: number }[]> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);
  return db.room.findMany({
    where:   subject.kind === "PROJECT" ? { projectId: subject.id } : { leadId: subject.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select:  { id: true, name: true, floorLabel: true, sortOrder: true },
  });
}
