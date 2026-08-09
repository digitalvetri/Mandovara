// Make repository — kanban list + detail read.
//
// listMakeJobs returns every non-DELIVERED job grouped by status, in
// the order the kanban swim-lanes appear on screen. DELIVERED jobs
// are terminal and disappear from the board (they still exist for
// audit and analytics; a future /make/history view will surface them).
//
// getMakeJob returns the full detail: header + cut list rows enriched
// with product name / uom / measurement roomLabel / snapshot outputs
// so the tailor sees the same numbers the estimator did.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MakeJobStatus } from "./schema";

export interface KanbanCard {
  id:            string;
  number:        string;
  orderId:       string;
  orderNumber:   string;
  clientName:    string;
  clientMobile:  string;
  projectName:   string | null;
  targetDate:    Date | null;
  createdAt:     Date;
  lineCount:     number;
  agedDays:      number;     // days since createdAt — sorted asc within lane
}

export type KanbanBoard = Record<
  Exclude<MakeJobStatus, "DELIVERED">,
  KanbanCard[]
>;

export interface MakeJobDetail {
  id:           string;
  number:       string;
  status:       MakeJobStatus;
  targetDate:   Date | null;
  startedAt:    Date | null;
  completedAt:  Date | null;
  createdAt:    Date;
  orderId:      string;
  orderNumber:  string;
  clientId:     string;
  clientName:   string;
  clientMobile: string;
  projectName:  string | null;
  lines:        MakeJobDetailLine[];
}

export interface MakeJobDetailLine {
  id:                string;
  orderLineId:       string;
  productCode:       string;
  productName:       string;
  productUom:        string;
  roomLabel:         string;
  panels:            number | null;
  cutLengthMm:       number | null;
  fabricIssuedM:     number | null;
  liningIssuedM:     number | null;
  actualUsedM:       number | null;
  wastageM:          number | null;
  eyeletCount:       number | null;
  headingType:       string | null;
  qcPassed:          boolean;
  qcNotes:           string | null;
  // Passed through so the detail page can show heading + eyelet
  // context and warnings from the frozen engine run without an
  // extra join.
  snapshotOutputs:   Record<string, unknown> | null;
  snapshotWarnings:  string[] | null;
  engineVersion:     string | null;
}

const KANBAN_LANES: Exclude<MakeJobStatus, "DELIVERED">[] = [
  "QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC", "READY",
];

export async function listMakeJobs(ctx: RequestContext): Promise<KanbanBoard> {
  requirePermission(ctx, "make.view");
  const db = scoped(ctx);

  const rows = await db.makeJob.findMany({
    where:   { status: { not: "DELIVERED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, number: true, status: true, targetDate: true, createdAt: true,
      salesOrder: {
        select: {
          id: true, number: true,
          client: { select: { name: true, primaryMobile: true } },
        },
      },
      _count: { select: { lines: true } },
    },
  });

  const now = Date.now();
  const board = Object.fromEntries(
    KANBAN_LANES.map((lane) => [lane, [] as KanbanCard[]]),
  ) as KanbanBoard;

  for (const r of rows) {
    const card: KanbanCard = {
      id:           r.id,
      number:       r.number,
      orderId:      r.salesOrder.id,
      orderNumber:  r.salesOrder.number,
      clientName:   r.salesOrder.client.name,
      clientMobile: r.salesOrder.client.primaryMobile,
      projectName:  null,
      targetDate:   r.targetDate,
      createdAt:    r.createdAt,
      lineCount:    r._count.lines,
      agedDays:     Math.floor((now - r.createdAt.getTime()) / 86_400_000),
    };
    // MakeJobStatus includes DELIVERED which we exclude from lanes;
    // this cast is safe because we filtered the query above.
    (board[r.status as Exclude<MakeJobStatus, "DELIVERED">] ??= []).push(card);
  }

  return board;
}

export async function getMakeJob(
  ctx: RequestContext, id: string,
): Promise<MakeJobDetail | null> {
  requirePermission(ctx, "make.view");
  const db = scoped(ctx);

  const row = await db.makeJob.findUnique({
    where: { id },
    select: {
      id: true, number: true, status: true,
      targetDate: true, startedAt: true, completedAt: true, createdAt: true,
      salesOrder: {
        select: {
          id: true, number: true,
          client: { select: { id: true, name: true, primaryMobile: true } },
        },
      },
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true, orderLineId: true, roomLabel: true,
          panels: true, cutLengthMm: true,
          fabricIssuedM: true, liningIssuedM: true,
          actualUsedM: true, wastageM: true,
          eyeletCount: true, headingType: true,
          qcPassed: true, qcNotes: true,
          orderLine: {
            select: {
              calcSnapshot: true,
              product: { select: { code: true, name: true, uom: true } },
            },
          },
        },
      },
    },
  });
  if (!row) return null;

  return {
    id:           row.id,
    number:       row.number,
    status:       row.status,
    targetDate:   row.targetDate,
    startedAt:    row.startedAt,
    completedAt:  row.completedAt,
    createdAt:    row.createdAt,
    orderId:      row.salesOrder.id,
    orderNumber:  row.salesOrder.number,
    clientId:     row.salesOrder.client.id,
    clientName:   row.salesOrder.client.name,
    clientMobile: row.salesOrder.client.primaryMobile,
    projectName:  null,
    lines: row.lines.map((l) => {
      const snap = extractSnapshot(l.orderLine.calcSnapshot);
      return {
        id:                l.id,
        orderLineId:       l.orderLineId,
        productCode:       l.orderLine.product.code,
        productName:       l.orderLine.product.name,
        productUom:        l.orderLine.product.uom,
        roomLabel:         l.roomLabel,
        panels:            l.panels,
        cutLengthMm:       l.cutLengthMm == null ? null : Number(l.cutLengthMm),
        fabricIssuedM:     l.fabricIssuedM == null ? null : Number(l.fabricIssuedM),
        liningIssuedM:     l.liningIssuedM == null ? null : Number(l.liningIssuedM),
        actualUsedM:       l.actualUsedM   == null ? null : Number(l.actualUsedM),
        wastageM:          l.wastageM      == null ? null : Number(l.wastageM),
        eyeletCount:       l.eyeletCount,
        headingType:       l.headingType,
        qcPassed:          l.qcPassed,
        qcNotes:           l.qcNotes,
        snapshotOutputs:   snap.outputs,
        snapshotWarnings:  snap.warnings,
        engineVersion:     snap.engineVersion,
      };
    }),
  };
}

// Returns the make job (if any) that was minted from this sales order.
// Used by /orders/[id] to decide between "Create make job" and "Open
// make job {number}" buttons.
export async function getMakeJobForOrder(
  ctx: RequestContext, orderId: string,
): Promise<{ id: string; number: string; status: MakeJobStatus } | null> {
  requirePermission(ctx, "make.view");
  const db = scoped(ctx);
  return await db.makeJob.findUnique({
    where:  { salesOrderId: orderId },
    select: { id: true, number: true, status: true },
  });
}

// ── helpers ──────────────────────────────────────────────────────

function extractSnapshot(snap: unknown): {
  outputs: Record<string, unknown> | null;
  warnings: string[] | null;
  engineVersion: string | null;
} {
  if (snap == null || typeof snap !== "object") {
    return { outputs: null, warnings: null, engineVersion: null };
  }
  const s = snap as { outputs?: unknown; warnings?: unknown; engineVersion?: unknown };
  return {
    outputs: s.outputs != null && typeof s.outputs === "object"
      ? (s.outputs as Record<string, unknown>) : null,
    warnings: Array.isArray(s.warnings)
      ? s.warnings.filter((w): w is string => typeof w === "string") : null,
    engineVersion: typeof s.engineVersion === "string" ? s.engineVersion : null,
  };
}
