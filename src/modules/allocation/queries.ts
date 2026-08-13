// Allocation console repository. Read-side helpers for /purchase/allocation.
//
// Models used: Order (not SalesOrder), OrderLine.colourwayId (not productId),
// StockBalance (not Batch), Allocation (not LotAllocation).

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface OpenOrderLineRow {
  id:               string;
  orderId:          string;
  orderNumber:      string;
  clientName:       string;
  colourwayId:      string;
  colourCode:       string;
  colourName:       string;
  unit:             string;
  orderedQty:       string;
  allocatedQty:     string;
  neededQty:        string;
  existingLotCount: number;
  existingLots:     string[];
  // UI compat aliases
  salesOrderNumber: string;
  productName:      string;
  uom:              string;
  reservedQty:      string;   // alias for allocatedQty
  trackBatch:       boolean;  // always true for colourway lines
}

export interface AvailableLotRow {
  batchId:      string;   // StockBalance.id
  colourwayId:  string;
  dyeLot:       string;
  onHand:       string;
  allocated:    string;   // StockBalance.reserved
  available:    string;
  binLocation:  string | null;
  warehouseName: string;
  createdAt:    Date;
}

export interface AllocationRow {
  id:               string;
  orderLineId:      string;
  dyeLot:           string | null;
  quantity:         string;
  mixedLotOverride: boolean;
  overrideReason:   string | null;
  createdAt:        Date;
}

const OPEN_ORDER_STATUSES = ["CONFIRMED", "PROCUREMENT", "MAKE"] as const;

export async function listOpenOrderLines(
  ctx: RequestContext,
): Promise<OpenOrderLineRow[]> {
  requirePermission(ctx, "allocation.view");
  const db = scoped(ctx);

  const orders = await db.order.findMany({
    where:   { status: { in: [...OPEN_ORDER_STATUSES] } },
    orderBy: { date: "desc" },
    take:    200,
    select: {
      id: true, number: true,
      project: { select: { client: { select: { name: true } } } },
      lines: {
        where:  { colourwayId: { not: null } },
        select: {
          id: true, colourwayId: true, quantity: true, unit: true,
          colourway: { select: { code: true, colourName: true } },
        },
      },
    },
  });

  // Fetch allocations separately — Allocation.orderLineId is a plain string, no FK relation
  const allLineIds = orders.flatMap((o) => o.lines.map((l) => l.id));
  const allAllocations = allLineIds.length > 0
    ? await db.allocation.findMany({
        where:  { orderLineId: { in: allLineIds } },
        select: { orderLineId: true, quantity: true, dyeLot: true },
      })
    : [];
  const allocByLine = new Map<string, typeof allAllocations>();
  for (const a of allAllocations) {
    const arr = allocByLine.get(a.orderLineId) ?? [];
    arr.push(a);
    allocByLine.set(a.orderLineId, arr);
  }

  const rows: OpenOrderLineRow[] = [];
  for (const o of orders) {
    for (const line of o.lines) {
      if (!line.colourwayId || !line.colourway) continue;
      const lineAllocs = allocByLine.get(line.id) ?? [];
      const ordered   = Number(line.quantity);
      const allocated = lineAllocs.reduce((s, a) => s + Number(a.quantity), 0);
      const needed    = ordered - allocated;
      if (needed <= 0.001) continue;
      const lots = [...new Set(lineAllocs.map((a) => a.dyeLot).filter(Boolean) as string[])];
      rows.push({
        id:               line.id,
        orderId:          o.id,
        orderNumber:      o.number,
        clientName:       o.project.client.name,
        colourwayId:      line.colourwayId,
        colourCode:       line.colourway.code,
        colourName:       line.colourway.colourName,
        unit:             line.unit,
        orderedQty:       ordered.toString(),
        allocatedQty:     allocated.toString(),
        neededQty:        needed.toString(),
        existingLotCount: lots.length,
        existingLots:     lots,
        // UI compat aliases
        salesOrderNumber: o.number,
        productName:      `${line.colourway.colourName} (${line.colourway.code})`,
        uom:              line.unit,
        reservedQty:      allocated.toString(),
        trackBatch:       true,
      });
    }
  }
  return rows;
}

export async function listAvailableLotsForProduct(
  ctx: RequestContext,
  colourwayId: string,
): Promise<AvailableLotRow[]> {
  requirePermission(ctx, "allocation.view");
  const db = scoped(ctx);

  const balances = await db.stockBalance.findMany({
    where:   { colourwayId },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true, colourwayId: true, dyeLot: true,
      quantity: true, reserved: true, binLocation: true, updatedAt: true,
    },
  });

  return balances
    .map((b) => {
      const onHand    = Number(b.quantity);
      const allocated = Number(b.reserved);
      const available = onHand - allocated;
      return {
        batchId:      b.id,
        colourwayId:  b.colourwayId,
        dyeLot:       b.dyeLot ?? "(no lot)",
        onHand:       onHand.toString(),
        allocated:    allocated.toString(),
        available:    available.toString(),
        binLocation:  b.binLocation,
        warehouseName: b.binLocation ?? "Stock",
        createdAt:    b.updatedAt,
      };
    })
    .filter((r) => Number(r.available) > 0.001);
}

export async function listAllocationsForOrderLine(
  ctx: RequestContext,
  orderLineId: string,
): Promise<AllocationRow[]> {
  requirePermission(ctx, "allocation.view");
  const db = scoped(ctx);
  const rows = await db.allocation.findMany({
    where:   { orderLineId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, orderLineId: true, dyeLot: true, quantity: true,
      mixedLotOverride: true, overrideReason: true, createdAt: true,
    },
  });
  return rows.map((r) => ({
    id:               r.id,
    orderLineId:      r.orderLineId,
    dyeLot:           r.dyeLot,
    quantity:         Number(r.quantity).toString(),
    mixedLotOverride: r.mixedLotOverride,
    overrideReason:   r.overrideReason,
    createdAt:        r.createdAt,
  }));
}
