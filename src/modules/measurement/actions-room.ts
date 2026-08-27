"use server";

// Room creation — split out of actions.ts (2026-08-27) when lead-scoped
// measurement pushed that file past CLAUDE.md §10's 300-line ceiling.
//
// A room belongs to a project OR a lead, never both. The party is
// resolved once here and spread into every query, so the "which side is
// this?" branch exists in one place rather than at each of the four
// database calls below.

import { revalidatePath } from "next/cache";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { createRoomSchema } from "./schema";
import { type ActionResult, zodError, revalidateRound } from "./actions-shared";

export async function createRoom(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "measurement.create");
  const parsed = createRoomSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);
  const party = d.projectId
    ? { projectId: d.projectId, leadId: null }
    : { projectId: null, leadId: d.leadId ?? null };

  if (d.projectId) {
    const project = await db.project.findUnique({ where: { id: d.projectId }, select: { id: true } });
    if (!project) return { ok: false, error: "Project not found" };
  } else {
    const lead = await db.lead.findUnique({ where: { id: d.leadId ?? "" }, select: { id: true } });
    if (!lead) return { ok: false, error: "Lead not found" };
  }

  const last = await db.room.findFirst({
    where:   party,
    orderBy: { sortOrder: "desc" },
    select:  { sortOrder: true },
  });
  const room = await db.room.create({
    data: {
      organizationId: ctx.orgId,
      ...party,
      name:           d.name,
      floorLabel:     d.floorLabel ?? null,
      sortOrder:      (last?.sortOrder ?? 0) + 10,
    },
    select: { id: true },
  });
  revalidateRound(revalidatePath, party);
  return { ok: true, data: room };
}
