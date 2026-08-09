// Allocation console repository. Read-side helpers for /purchase/allocation.
//
// The console shows:
//   - open order lines that still need material (orderedQty − reservedQty > 0)
//   - available dye-lot batches for the selected line's product/warehouse
//   - the existing lot allocations on that line (so the mixed-lot risk is visible)

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface OpenOrderLineRow {
  id: string;
  salesOrderId: string;
  salesOrderNumber: string;
  clientName: string;
  productId: string;
  productCode: string;
  productName: string;
  trackBatch: boolean;
  uom: string;
  orderedQty: string;
  reservedQty: string;
  neededQty: string;
  existingLotCount: number;
  existingLots: string[]; // dye-lot codes already on this line
}

export interface AvailableLotRow {
  batchId: string;
  productId: string;
  dyeLot: string;
  warehouseId: string;
  warehouseName: string;
  onHand: string;
  allocated: string;
  available: string;
  binLocation: string | null;
  rollCount: number | null;
  createdAt: Date;
}

export interface AllocationRow {
  id: string;
  orderLineId: string;
  batchId: string;
  dyeLot: string;
  quantity: string;
  mixedLotOverride: boolean;
  overrideReason: string | null;
  createdAt: Date;
}

const OPEN_ORDER_STATUSES = ["CONFIRMED", "PARTIAL_DISPATCH"] as const;

export async function listOpenOrderLines(
  ctx: RequestContext,
): Promise<OpenOrderLineRow[]> {
  requirePermission(ctx, "allocation.view");
  const db = scoped(ctx);

  const orders = await db.salesOrder.findMany({
    where: { status: { in: OPEN_ORDER_STATUSES as unknown as string[] } as never },
    orderBy: { date: "desc" },
    take: 200,
    select: {
      id: true, number: true,
      client: { select: { name: true } },
      lines: {
        select: {
          id: true, productId: true, orderedQty: true, reservedQty: true,
          product: { select: { code: true, name: true, trackBatch: true, uom: true } },
          lotAllocations: {
            where: { releasedAt: null },
            select: { batch: { select: { batchNumber: true } } },
          },
        },
      },
    },
  });

  const rows: OpenOrderLineRow[] = [];
  for (const o of orders) {
    for (const line of o.lines) {
      const ordered = Number(line.orderedQty);
      const reserved = Number(line.reservedQty);
      const needed = ordered - reserved;
      if (needed <= 0) continue;
      const dyeLots = line.lotAllocations
        .map((a) => a.batch.batchNumber)
        .filter((v, i, arr) => arr.indexOf(v) === i);
      rows.push({
        id:               line.id,
        salesOrderId:     o.id,
        salesOrderNumber: o.number,
        clientName:       o.client.name,
        productId:        line.productId,
        productCode:      line.product.code,
        productName:      line.product.name,
        trackBatch:       line.product.trackBatch,
        uom:              line.product.uom,
        orderedQty:       line.orderedQty.toString(),
        reservedQty:      line.reservedQty.toString(),
        neededQty:        needed.toString(),
        existingLotCount: dyeLots.length,
        existingLots:     dyeLots,
      });
    }
  }
  return rows;
}

export async function listAvailableLotsForProduct(
  ctx: RequestContext,
  productId: string,
): Promise<AvailableLotRow[]> {
  requirePermission(ctx, "allocation.view");
  const db = scoped(ctx);

  const batches = await db.batch.findMany({
    where: { productId },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true, productId: true, batchNumber: true,
      warehouseId: true, quantity: true, binLocation: true,
      rollCount: true, createdAt: true,
      warehouse:   { select: { name: true } },
      allocations: {
        where: { releasedAt: null },
        select: { quantity: true },
      },
    },
  });

  return batches.map((b) => {
    const onHand = Number(b.quantity);
    const allocated = b.allocations.reduce((s, a) => s + Number(a.quantity), 0);
    const available = onHand - allocated;
    return {
      batchId:       b.id,
      productId:     b.productId,
      dyeLot:        b.batchNumber,
      warehouseId:   b.warehouseId,
      warehouseName: b.warehouse.name,
      onHand:        onHand.toString(),
      allocated:     allocated.toString(),
      available:     available.toString(),
      binLocation:   b.binLocation,
      rollCount:     b.rollCount,
      createdAt:     b.createdAt,
    };
  }).filter((r) => Number(r.available) > 0);
}

export async function listAllocationsForOrderLine(
  ctx: RequestContext,
  orderLineId: string,
): Promise<AllocationRow[]> {
  requirePermission(ctx, "allocation.view");
  const db = scoped(ctx);
  const rows = await db.lotAllocation.findMany({
    where: { orderLineId, releasedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, orderLineId: true, batchId: true, quantity: true,
      mixedLotOverride: true, overrideReason: true, createdAt: true,
      batch: { select: { batchNumber: true } },
    },
  });
  return rows.map((r) => ({
    id:               r.id,
    orderLineId:      r.orderLineId,
    batchId:          r.batchId,
    dyeLot:           r.batch.batchNumber,
    quantity:         r.quantity.toString(),
    mixedLotOverride: r.mixedLotOverride,
    overrideReason:   r.overrideReason,
    createdAt:        r.createdAt,
  }));
}
