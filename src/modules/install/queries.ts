// Install repository.
//
// listUpcomingVisits: grouped-by-day slice for the calendar (default
// window 7 days). Each visit carries the crew name and the client
// context the router needs to render a card.
//
// getInstallVisit: full detail for the office-view page. Includes
// the line list, snags raised on this visit (matched by the "[Visit
// N]" description prefix — SnagItem has no direct FK to InstallVisit
// today), and the source order/make-job status so the completeVisit
// gate can be surfaced before the click.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { InstallStatus } from "./schema";

export interface CalendarVisit {
  id:            string;
  number:        string;
  scheduledAt:   Date;
  status:        InstallStatus;
  crewId:        string | null;
  crewName:      string | null;
  clientName:    string;
  clientMobile:  string;
  orderId:       string;
  orderNumber:   string;
  lineCount:     number;
  installedPct:  number;   // 0..100
  hasSignature:  boolean;
}

export interface CrewOption {
  id:       string;
  name:     string;
  isActive: boolean;
}

export interface InstallVisitDetail {
  id:                 string;
  number:             string;
  status:             InstallStatus;
  scheduledAt:        Date;
  startedAt:          Date | null;
  completedAt:        Date | null;
  clientSignatureKey: string | null;
  photoKeys:          string[];
  notes:              string | null;
  crewId:             string | null;
  crewName:           string | null;
  orderId:            string;
  orderNumber:        string;
  clientId:           string;
  clientName:         string;
  clientMobile:       string;
  makeJobStatus:      string | null;      // null when order has no make job
  makeJobNumber:      string | null;
  lines:              InstallLineDetail[];
  snags:              VisitSnag[];
}
export interface InstallLineDetail {
  id:            string;
  orderLineId:   string;
  roomLabel:     string;
  productName:   string;
  productUom:    string;
  plannedQty:    string;
  installedQty:  string;
  dyeLotUsed:    string | null;
  photoKeys:     string[];
  remoteSerials: string[];
  issue:         string | null;
  // Server-side pending qty on the parent OrderLine (across ALL
  // visits) so the UI can gate the "install more" button.
  parentPendingQty: string;
}
export interface VisitSnag {
  id:          string;
  location:    string;
  description: string;
  status:      string;
  raisedAt:    Date | null;
  raisedById:  string | null;
}

// ── list for the calendar ────────────────────────────────────────
export async function listUpcomingVisits(
  ctx: RequestContext, windowDays = 14,
): Promise<CalendarVisit[]> {
  requirePermission(ctx, "install.view");
  const db = scoped(ctx);
  const now = new Date();
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(now.getDate() - 1);
  const to   = new Date(); to.setDate(now.getDate() + windowDays); to.setHours(23, 59, 59, 999);

  const rows = await db.installVisit.findMany({
    where: {
      scheduledAt: { gte: from, lte: to },
      status: { notIn: ["CANCELLED"] },
    },
    orderBy: [{ scheduledAt: "asc" }],
    take: 200,
    select: {
      id: true, number: true, scheduledAt: true, status: true,
      clientSignatureKey: true,
      crew: { select: { id: true, name: true } },
      salesOrder: {
        select: {
          id: true, number: true,
          client: { select: { name: true, primaryMobile: true } },
        },
      },
      lines: {
        select: { installedQty: true, plannedQty: true },
      },
    },
  });

  return rows.map((r) => {
    const planned = r.lines.reduce((n, l) => n + Number(l.plannedQty), 0);
    const done    = r.lines.reduce((n, l) => n + Number(l.installedQty), 0);
    return {
      id:            r.id,
      number:        r.number,
      scheduledAt:   r.scheduledAt,
      status:        r.status,
      crewId:        r.crew?.id ?? null,
      crewName:      r.crew?.name ?? null,
      clientName:    r.salesOrder.client.name,
      clientMobile:  r.salesOrder.client.primaryMobile,
      orderId:       r.salesOrder.id,
      orderNumber:   r.salesOrder.number,
      lineCount:     r.lines.length,
      installedPct:  planned === 0 ? 0 : Math.min(100, Math.round((done / planned) * 100)),
      hasSignature:  r.clientSignatureKey != null,
    };
  });
}

// ── crews for the picker ─────────────────────────────────────────
export async function listCrews(ctx: RequestContext): Promise<CrewOption[]> {
  requirePermission(ctx, "install.view");
  const db = scoped(ctx);
  const rows = await db.installCrew.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    take:    100,
    select:  { id: true, name: true, isActive: true },
  });
  return rows;
}

// ── visit detail ─────────────────────────────────────────────────
export async function getInstallVisit(
  ctx: RequestContext, id: string,
): Promise<InstallVisitDetail | null> {
  requirePermission(ctx, "install.view");
  const db = scoped(ctx);
  const row = await db.installVisit.findUnique({
    where: { id },
    select: {
      id: true, number: true, status: true,
      scheduledAt: true, startedAt: true, completedAt: true,
      clientSignatureKey: true, photoKeys: true, notes: true,
      crew: { select: { id: true, name: true } },
      salesOrder: {
        select: {
          id: true, number: true,
          client: { select: { id: true, name: true, primaryMobile: true } },
          makeJobs: { select: { status: true, number: true }, take: 1 },
        },
      },
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true, orderLineId: true, roomLabel: true,
          plannedQty: true, installedQty: true,
          dyeLotUsed: true, photoKeys: true, remoteSerials: true, issue: true,
          orderLine: {
            select: {
              orderedQty: true, installedQty: true,
              product: { select: { name: true, uom: true } },
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  // Snags raised on this visit — matched by the "[Visit N]" prefix
  // convention that raiseSnagOnVisit writes. Not perfect (a project
  // may have unrelated snags with a lookalike prefix) but works for
  // 5c; a proper FK on SnagItem lands with the PWA in 5c-PWA.
  const projectMaybe = await db.snagItem.findMany({
    where: {
      project: { client: { orders: { some: { id: row.salesOrder.id } } } },
      description: { contains: `[Visit ${row.number}]` },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, location: true, description: true, status: true,
      raisedAt: true, raisedById: true,
    },
  });

  return {
    id:                 row.id,
    number:             row.number,
    status:             row.status,
    scheduledAt:        row.scheduledAt,
    startedAt:          row.startedAt,
    completedAt:        row.completedAt,
    clientSignatureKey: row.clientSignatureKey,
    photoKeys:          row.photoKeys,
    notes:              row.notes,
    crewId:             row.crew?.id ?? null,
    crewName:           row.crew?.name ?? null,
    orderId:            row.salesOrder.id,
    orderNumber:        row.salesOrder.number,
    clientId:           row.salesOrder.client.id,
    clientName:         row.salesOrder.client.name,
    clientMobile:       row.salesOrder.client.primaryMobile,
    makeJobStatus:      row.salesOrder.makeJobs[0]?.status ?? null,
    makeJobNumber:      row.salesOrder.makeJobs[0]?.number ?? null,
    lines: row.lines.map((l) => ({
      id:            l.id,
      orderLineId:   l.orderLineId,
      roomLabel:     l.roomLabel,
      productName:   l.orderLine.product.name,
      productUom:    l.orderLine.product.uom,
      plannedQty:    l.plannedQty.toString(),
      installedQty:  l.installedQty.toString(),
      dyeLotUsed:    l.dyeLotUsed,
      photoKeys:     l.photoKeys,
      remoteSerials: l.remoteSerials,
      issue:         l.issue,
      parentPendingQty: l.orderLine.orderedQty.minus(l.orderLine.installedQty).toString(),
    })),
    snags: projectMaybe.map((s) => ({
      id: s.id, location: s.location, description: s.description,
      status: s.status, raisedAt: s.raisedAt, raisedById: s.raisedById,
    })),
  };
}

// ── list visits for a given order (used by /orders/[id]) ────────
export async function listVisitsForOrder(
  ctx: RequestContext, salesOrderId: string,
): Promise<{ id: string; number: string; status: InstallStatus; scheduledAt: Date }[]> {
  requirePermission(ctx, "install.view");
  const db = scoped(ctx);
  const rows = await db.installVisit.findMany({
    where:   { salesOrderId },
    orderBy: { scheduledAt: "asc" },
    select:  { id: true, number: true, status: true, scheduledAt: true },
  });
  return rows;
}
