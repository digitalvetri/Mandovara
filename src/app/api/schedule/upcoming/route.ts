// Schedule calendar data endpoint.
// GET /api/schedule/upcoming?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns follow-ups AND scheduled site visits for the given date range.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

export interface CalendarItem {
  id:        string;
  dueAt:     string;   // ISO 8601
  kind:      "followup" | "sitevisit";
  note:      string;
  refType:   string;   // LEAD | CLIENT | QUOTATION | PROJECT
  refId:     string;
  refLabel:  string;   // lead/client/project name
  ownerName: string;
  status:    "OPEN" | "OVERDUE" | "COMPLETED";
}

const PURPOSE_LABEL: Record<string, string> = {
  INITIAL_SURVEY: "Initial Survey",
  MEASUREMENT:    "Measurement",
  SAMPLE_SHOWING: "Sample Showing",
  SUPERVISION:    "Supervision",
  SNAG_FIX:       "Snag Fix",
  HANDOVER:       "Handover",
};

function startOfDay(d: Date): Date { const c = new Date(d); c.setHours(0,0,0,0); return c; }

export async function GET(req: Request): Promise<Response> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const url = new URL(req.url);

  const fromStr = url.searchParams.get("from");
  const toStr   = url.searchParams.get("to");

  const now = new Date();
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : startOfDay(now);
  const to   = toStr   ? new Date(`${toStr}T23:59:59`)
                       : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Fetch both follow-ups and site visits in parallel
  const [rows, visits] = await Promise.all([
    db.followUp.findMany({
      where:   { dueAt: { gte: from, lte: to } },
      orderBy: { dueAt: "asc" },
      take:    300,
      select:  { id: true, dueAt: true, note: true, refType: true, refId: true, ownerId: true, completedAt: true },
    }),
    db.siteVisit.findMany({
      where: {
        scheduledAt: { gte: from, lte: to },
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
      orderBy: { scheduledAt: "asc" },
      take:    200,
      select:  { id: true, scheduledAt: true, purpose: true, assignedToId: true, leadId: true, projectId: true },
    }),
  ]);

  // Collect all IDs that need label/owner resolution
  const ownerIds  = [...new Set([...rows.map(r => r.ownerId), ...visits.map(v => v.assignedToId)])];
  const leadIds   = [...new Set([
    ...rows.filter(r => r.refType === "LEAD").map(r => r.refId),
    ...visits.filter(v => v.leadId).map(v => v.leadId!),
  ])];
  const clientIds = rows.filter(r => r.refType === "CLIENT").map(r => r.refId);
  const quotIds   = rows.filter(r => r.refType === "QUOTATION").map(r => r.refId);
  const projIds   = visits.filter(v => v.projectId).map(v => v.projectId!);

  const [owners, leads, clients, quotations, projects] = await Promise.all([
    db.user.findMany({     where: { id: { in: ownerIds } },  select: { id: true, name: true } }),
    leadIds.length  ? db.lead.findMany({      where: { id: { in: leadIds } },   select: { id: true, name: true } })         : [],
    clientIds.length? db.client.findMany({    where: { id: { in: clientIds } }, select: { id: true, name: true } })         : [],
    quotIds.length  ? db.quotation.findMany({ where: { id: { in: quotIds } },   select: { id: true, number: true } })       : [],
    projIds.length  ? db.project.findMany({   where: { id: { in: projIds } },   select: { id: true, name: true } })         : [],
  ]);

  const ownerMap = new Map(owners.map(o => [o.id, o.name]));
  const labelMap = new Map<string, string>();
  for (const l of leads)      labelMap.set(l.id, l.name);
  for (const c of clients)    labelMap.set(c.id, c.name);
  for (const q of quotations) labelMap.set(q.id, q.number);
  for (const p of projects)   labelMap.set(p.id, p.name);

  const todayStart = startOfDay(now);

  const followUpItems: CalendarItem[] = rows.map(r => ({
    id:        r.id,
    dueAt:     r.dueAt.toISOString(),
    kind:      "followup",
    note:      r.note || "",
    refType:   r.refType,
    refId:     r.refId,
    refLabel:  labelMap.get(r.refId) ?? r.refType,
    ownerName: ownerMap.get(r.ownerId) ?? "—",
    status:    r.completedAt != null ? "COMPLETED"
             : r.dueAt < todayStart  ? "OVERDUE"
             : "OPEN",
  }));

  const siteVisitItems: CalendarItem[] = visits.map(v => ({
    id:        v.id,
    dueAt:     v.scheduledAt.toISOString(),
    kind:      "sitevisit",
    note:      PURPOSE_LABEL[v.purpose] ?? v.purpose,
    refType:   v.leadId ? "LEAD" : "PROJECT",
    refId:     (v.leadId ?? v.projectId) as string,
    refLabel:  labelMap.get((v.leadId ?? v.projectId) as string) ?? "—",
    ownerName: ownerMap.get(v.assignedToId) ?? "—",
    status:    v.scheduledAt < todayStart ? "OVERDUE" : "OPEN",
  }));

  const items = [...followUpItems, ...siteVisitItems]
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return NextResponse.json({ rows: items });
}
