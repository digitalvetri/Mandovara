// Client-scoped measurement read-side. Powers the Measurements card on
// the Client 360 (2026-08-26). Split from queries.ts to keep both files
// under the CLAUDE.md §10 300-line ceiling.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface ClientRoundRow {
  id:            string;
  number:        string;
  visitedAt:     Date;
  status:        string;
  projectId:     string;
  projectName:   string;
  projectNumber: string;
  itemCount:     number;
}

/** Recent measurement rounds across every project of a client. */
export async function listRoundsForClient(
  ctx:      RequestContext,
  clientId: string,
  limit:    number = 10,
): Promise<ClientRoundRow[]> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);

  const rounds = await db.measurement.findMany({
    where:   { project: { clientId } },
    orderBy: [{ visitedAt: "desc" }, { revision: "desc" }],
    take:    limit,
    select: {
      id: true, number: true, visitedAt: true, status: true,
      project: { select: { id: true, name: true, number: true } },
      items:   { select: { id: true } },
    },
  });

  return rounds.map((r) => ({
    id:            r.id,
    number:        r.number,
    visitedAt:     r.visitedAt,
    status:        r.status,
    projectId:     r.project.id,
    projectName:   r.project.name,
    projectNumber: r.project.number,
    itemCount:     r.items.length,
  }));
}
