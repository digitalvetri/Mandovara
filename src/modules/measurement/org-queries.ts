// Org-wide read-side for the top-level /measurements page.
// Feeds one row per round (across every project the user can see),
// filterable by status and searchable by project or round number.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MeasurementStatusStr } from "./queries-types";

export interface OrgRoundRow {
  id:             string;
  number:         string;
  revision:       number;
  visitedAt:      Date;
  status:         MeasurementStatusStr;
  measuredById:   string;
  measuredByName: string;
  itemCount:      number;
  roomCount:      number;
  supersedesId:   string | null;
  project: {
    id:         string;
    name:       string;
    number:     string;
    clientName: string;
  };
}

export interface ListOrgRoundsQuery {
  status?: MeasurementStatusStr;
  search?: string;   // matches round number or project name/client name
  page?:   number;   // 1-indexed
}

const PAGE_SIZE = 40;

export interface ListOrgRoundsResult {
  rows:  OrgRoundRow[];
  page:  number;
  hasNext: boolean;
  totalCounts: Record<MeasurementStatusStr, number>;
}

export async function listOrgRounds(
  ctx:   RequestContext,
  query: ListOrgRoundsQuery = {},
): Promise<ListOrgRoundsResult> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);
  const page = query.page && query.page > 0 ? query.page : 1;

  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    const s = query.search.trim();
    if (s.length > 0) {
      where.OR = [
        { number: { contains: s, mode: "insensitive" } },
        { project: { name:   { contains: s, mode: "insensitive" } } },
        { project: { number: { contains: s, mode: "insensitive" } } },
        { project: { client: { name: { contains: s, mode: "insensitive" } } } },
      ];
    }
  }

  const rounds = await db.measurement.findMany({
    where,
    orderBy: [{ visitedAt: "desc" }, { revision: "desc" }],
    take:  PAGE_SIZE + 1,   // one extra to know if there's a next page
    skip:  (page - 1) * PAGE_SIZE,
    select: {
      id: true, number: true, revision: true, visitedAt: true,
      status: true, measuredById: true, supersedesId: true,
      project: {
        select: {
          id: true, name: true, number: true,
          client: { select: { name: true } },
        },
      },
      items: { select: { id: true, roomId: true } },
    },
  });

  const hasNext = rounds.length > PAGE_SIZE;
  const window  = hasNext ? rounds.slice(0, PAGE_SIZE) : rounds;

  const userIds = new Set(window.map((r) => r.measuredById));
  const users = await db.user.findMany({
    where:  { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name] as const));

  const rows: OrgRoundRow[] = window.map((r) => ({
    id:             r.id,
    number:         r.number,
    revision:       r.revision,
    visitedAt:      r.visitedAt,
    status:         r.status,
    measuredById:   r.measuredById,
    measuredByName: nameOf.get(r.measuredById) ?? "—",
    itemCount:      r.items.length,
    roomCount:      new Set(r.items.map((i) => i.roomId)).size,
    supersedesId:   r.supersedesId,
    project: {
      id:         r.project.id,
      name:       r.project.name,
      number:     r.project.number,
      clientName: r.project.client.name,
    },
  }));

  // Header pills — one groupBy per status.  Cheap enough at this scale
  // and avoids maintaining a materialised counter.
  const grouped = await db.measurement.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const totalCounts: Record<MeasurementStatusStr, number> = {
    DRAFT: 0, SUBMITTED: 0, APPROVED: 0, SUPERSEDED: 0,
  };
  for (const g of grouped) totalCounts[g.status] = g._count._all;

  return { rows, page, hasNext, totalCounts };
}
