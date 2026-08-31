// Org-wide read-side for the top-level /measurements page.
// Feeds one row per round — across every project AND every lead the user
// can see (leads became measurable 2026-08-27) — filterable by status and
// searchable by project or round number.
//
// Note the search still only matches project fields. A lead-scoped round
// is findable by its own MEA number; matching lead names would need a
// second query since leadId carries no relation, and no one has asked.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MeasurementStatusStr } from "./queries-types";
import { resolveSubject, type RoundSubject } from "./subject";
import { resolveClients } from "@/kernel/db/resolve-clients";

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
  /** The project OR lead this round belongs to — see ./subject. */
  subject:        RoundSubject;
  /**
   * The client, when the round belongs to a project that has one.
   * Owner instruction 2026-08-27: "on the combined page of site visit
   * management and measurements we also need to access the client's
   * measurement details" — so the client is a first-class, filterable
   * column here, not something you find by opening each round.
   */
  clientId:       string | null;
  clientName:     string | null;
}

export interface ListOrgRoundsQuery {
  /** Narrow to one client's rounds across all their projects. */
  clientId?: string;
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
  if (query.clientId) where.project = { clientId: query.clientId };
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
      leadId: true,
      project: {
        select: {
          id: true, name: true, number: true,
          clientId: true,
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

  // Leads carry no Prisma relation (see ./subject) — fetch the ones this
  // page references in a single round-trip.
  const leadIds = [...new Set(window.map((r) => r.leadId).filter((v): v is string => !!v))];
  const leads = leadIds.length
    ? await db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true, number: true } })
    : [];
  const leadById = new Map(leads.map((l) => [l.id, l] as const));
  const clientMap = await resolveClients(db, window.map((r) => r.project?.clientId));

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
    subject:        resolveSubject(
      r.project ? { ...r.project, client: clientMap.get(r.project.clientId) ?? null } : null,
      r.leadId ? leadById.get(r.leadId) : null,
    ),
    clientId:       r.project?.clientId ?? null,
    clientName:     r.project ? clientMap.get(r.project.clientId)?.name ?? null : null,
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
