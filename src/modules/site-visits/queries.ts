// SiteVisit module — read side.
// SiteVisit separates scheduled field visits from Measurement records.
// A visit can trigger one or more measurements, or just be a survey/supervision.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { resolveClients, resolveClient, UNKNOWN_CLIENT } from "@/kernel/db/resolve-clients";

export interface SiteVisitRow {
  id:           string;
  number:       string;
  purpose:      string;
  scheduledAt:  Date;
  status:       string;
  assignedTo:   string;   // user name
  projectName:  string | null;
  clientName:   string | null;
  leadName:     string | null;
  observations: string | null;
}

export interface SiteVisitDetail extends SiteVisitRow {
  checkInLat:    string | null;
  checkInLng:    string | null;
  customerNotes: string | null;
  photoKeys:     string[];
  startedAt:     Date | null;
  completedAt:   Date | null;
  // Raw values needed by the stock-status panel (which only fires
  // for HANDOVER + a project). `purpose` above is a display label,
  // so the raw enum value ships alongside.
  purposeRaw:    string;
  projectId:     string | null;
}

const PURPOSE_LABEL: Record<string, string> = {
  INITIAL_SURVEY: "Initial Survey",
  MEASUREMENT:    "Measurement",
  SAMPLE_SHOWING: "Sample Showing",
  SUPERVISION:    "Supervision",
  SNAG_FIX:       "Snag Fix",
  HANDOVER:       "Handover",
};

export function purposeLabel(purpose: string): string {
  return PURPOSE_LABEL[purpose] ?? purpose;
}

export async function listSiteVisits(
  ctx: RequestContext,
  opts?: { assignedToMe?: boolean; projectId?: string; limit?: number },
): Promise<SiteVisitRow[]> {
  requirePermission(ctx, "sitelog.view");
  const db = scoped(ctx);

  const visits = await db.siteVisit.findMany({
    where: {
      ...(opts?.assignedToMe ? { assignedToId: ctx.userId } : {}),
      ...(opts?.projectId    ? { projectId: opts.projectId } : {}),
    },
    orderBy: { scheduledAt: "desc" },
    take: opts?.limit ?? 100,
    select: {
      id: true, number: true, purpose: true, scheduledAt: true, status: true,
      assignedToId: true, observations: true,
      project: {
        select: {
          name: true,
          clientId: true,
        },
      },
    },
  });

  // Resolve assignee names in one round-trip
  const userIds = [...new Set(visits.map((v) => v.assignedToId))];
  const userNames = await db.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(userNames.map((u) => [u.id, u.name]));
  const clientMap = await resolveClients(db, visits.map((v) => v.project?.clientId));

  return visits.map((v) => ({
    id:           v.id,
    number:       v.number,
    purpose:      purposeLabel(v.purpose),
    scheduledAt:  v.scheduledAt,
    status:       v.status,
    assignedTo:   nameById.get(v.assignedToId) ?? "—",
    projectName:  v.project?.name ?? null,
    clientName:   v.project ? clientMap.get(v.project.clientId)?.name ?? UNKNOWN_CLIENT : null,
    leadName:     null,
    observations: v.observations,
  }));
}

export async function listSiteVisitsForLead(
  ctx: RequestContext,
  leadId: string,
): Promise<SiteVisitRow[]> {
  requirePermission(ctx, "sitelog.view");
  const db = scoped(ctx);

  const visits = await db.siteVisit.findMany({
    where:   { leadId },
    orderBy: { scheduledAt: "desc" },
    select: {
      id: true, number: true, purpose: true,
      scheduledAt: true, status: true,
      assignedToId: true, observations: true,
    },
  });

  if (visits.length === 0) return [];

  const userIds = [...new Set(visits.map((v) => v.assignedToId))];
  const userNames = await db.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(userNames.map((u) => [u.id, u.name]));

  return visits.map((v) => ({
    id:          v.id,
    number:      v.number,
    purpose:     purposeLabel(v.purpose),
    scheduledAt: v.scheduledAt,
    status:      v.status,
    assignedTo:  nameById.get(v.assignedToId) ?? "—",
    projectName: null,
    clientName:  null,
    leadName:    null,
    observations: v.observations,
  }));
}

export async function getSiteVisit(
  ctx: RequestContext,
  id: string,
): Promise<SiteVisitDetail | null> {
  requirePermission(ctx, "sitelog.view");
  const db = scoped(ctx);

  const v = await db.siteVisit.findUnique({
    where: { id },
    select: {
      id: true, number: true, purpose: true, scheduledAt: true, status: true,
      assignedToId: true, observations: true, checkInLat: true, checkInLng: true,
      customerNotes: true, photoKeys: true, startedAt: true, completedAt: true,
      projectId: true,
      project: {
        select: {
          name: true,
          clientId: true,
        },
      },
    },
  });
  if (!v) return null;

  const assignee = await db.user.findUnique({ where: { id: v.assignedToId }, select: { name: true } });
  const client = await resolveClient(db, v.project?.clientId);

  return {
    id:           v.id,
    number:       v.number,
    purpose:      purposeLabel(v.purpose),
    scheduledAt:  v.scheduledAt,
    status:       v.status,
    assignedTo:   assignee?.name ?? "—",
    projectName:  v.project?.name ?? null,
    clientName:   v.project ? client?.name ?? UNKNOWN_CLIENT : null,
    leadName:     null,
    observations: v.observations,
    checkInLat:   v.checkInLat?.toString() ?? null,
    checkInLng:   v.checkInLng?.toString() ?? null,
    customerNotes: v.customerNotes,
    photoKeys:    v.photoKeys,
    startedAt:    v.startedAt,
    completedAt:  v.completedAt,
    purposeRaw:   v.purpose,
    projectId:    v.projectId ?? null,
  };
}

// ── Visit ↔ measurement join ────────────────────────────────────────
//
// The join that makes the two modules one. `Measurement.siteVisitId` was
// in the schema from the start and no code wrote it until 2026-08-27,
// which is why a visit page could never show what was measured on it.

export interface VisitMeasurementRound {
  id:        string;
  number:    string;
  revision:  number;
  status:    string;
  itemCount: number;
  visitedAt: Date;
}

export async function listRoundsForSiteVisit(
  ctx:         RequestContext,
  siteVisitId: string,
): Promise<VisitMeasurementRound[]> {
  requirePermission(ctx, "sitelog.view");
  const db = scoped(ctx);

  const rounds = await db.measurement.findMany({
    where:   { siteVisitId },
    orderBy: [{ visitedAt: "desc" }, { revision: "desc" }],
    select: {
      id: true, number: true, revision: true, status: true, visitedAt: true,
      _count: { select: { items: true } },
    },
  });

  return rounds.map((r) => ({
    id:        r.id,
    number:    r.number,
    revision:  r.revision,
    status:    r.status,
    itemCount: r._count.items,
    visitedAt: r.visitedAt,
  }));
}
