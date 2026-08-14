// Follow-up calendar data endpoint.
// GET /api/schedule/upcoming?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns enriched follow-ups (with lead/client name, owner name, status)
// for the given date range. Used by the calendar page.

import { NextResponse } from "next/server";
import { devContext } from "@/lib/dev-context";
import { scoped } from "@/kernel/db/scoped";

export interface CalendarItem {
  id:        string;
  dueAt:     string;   // ISO 8601
  note:      string;
  refType:   string;   // LEAD | CLIENT | QUOTATION
  refId:     string;
  refLabel:  string;   // lead/client name
  ownerName: string;
  status:    "OPEN" | "OVERDUE" | "COMPLETED";
}

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

  const rows = await db.followUp.findMany({
    where:   { dueAt: { gte: from, lte: to } },
    orderBy: { dueAt: "asc" },
    take:    300,
    select:  { id: true, dueAt: true, note: true, refType: true, refId: true, ownerId: true, completedAt: true },
  });

  if (rows.length === 0) return NextResponse.json({ rows: [] });

  // Batch-resolve labels + owner names
  const ownerIds    = [...new Set(rows.map(r => r.ownerId))];
  const leadIds     = rows.filter(r => r.refType === "LEAD").map(r => r.refId);
  const clientIds   = rows.filter(r => r.refType === "CLIENT").map(r => r.refId);
  const quotIds     = rows.filter(r => r.refType === "QUOTATION").map(r => r.refId);

  const [owners, leads, clients, quotations] = await Promise.all([
    db.user.findMany({     where: { id: { in: ownerIds } }, select: { id: true, name: true } }),
    leadIds.length  ? db.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })         : [],
    clientIds.length? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })     : [],
    quotIds.length  ? db.quotation.findMany({ where: { id: { in: quotIds } }, select: { id: true, number: true } }) : [],
  ]);

  const ownerMap = new Map(owners.map(o => [o.id, o.name]));
  const labelMap = new Map<string, string>();
  for (const l of leads)      labelMap.set(l.id, l.name);
  for (const c of clients)    labelMap.set(c.id, c.name);
  for (const q of quotations) labelMap.set(q.id, q.number);

  const todayStart = startOfDay(now);
  const items: CalendarItem[] = rows.map(r => ({
    id:        r.id,
    dueAt:     r.dueAt.toISOString(),
    note:      r.note || "",
    refType:   r.refType,
    refId:     r.refId,
    refLabel:  labelMap.get(r.refId) ?? r.refType,
    ownerName: ownerMap.get(r.ownerId) ?? "—",
    status:    r.completedAt != null ? "COMPLETED"
             : r.dueAt < todayStart  ? "OVERDUE"
             : "OPEN",
  }));

  return NextResponse.json({ rows: items });
}
