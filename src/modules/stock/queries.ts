import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// ── Stock balances ─────────────────────────────────────────────────────────────

export interface StockBalanceRow {
  id: string;
  colourwayId: string;
  colourwayCode: string;
  colourName: string;
  designCode: string;
  family: string;
  dyeLot: string | null;
  quantity: string;
  reserved: string;
  available: string;
  binLocation: string | null;
}

export async function listStockBalances(
  ctx: RequestContext,
  q: {
    colourwayId?: string;
    family?: string;
    dyeLot?: string | null;
    search?: string;
    includeZero?: boolean;
  } = {},
): Promise<StockBalanceRow[]> {
  requirePermission(ctx, "stock.view");
  const db = scoped(ctx);

  const rows = await db.stockBalance.findMany({
    where: {
      ...(q.colourwayId ? { colourwayId: q.colourwayId } : {}),
      ...(q.dyeLot !== undefined ? { dyeLot: q.dyeLot } : {}),
      ...(q.includeZero ? {} : { quantity: { gt: 0 } }),
    },
    orderBy: [{ colourwayId: "asc" }, { dyeLot: "asc" }],
    take: 500,
    select: {
      id: true, colourwayId: true, dyeLot: true,
      quantity: true, reserved: true, binLocation: true,
      colourway: {
        select: {
          code: true, colourName: true,
          design: { select: { code: true, family: true } },
        },
      },
    },
  });

  return rows
    .filter((r) => {
      if (q.family && r.colourway.design.family !== q.family) return false;
      if (q.search) {
        const s = q.search.toLowerCase();
        return (
          r.colourway.code.toLowerCase().includes(s) ||
          r.colourway.colourName.toLowerCase().includes(s) ||
          r.colourway.design.code.toLowerCase().includes(s) ||
          (r.dyeLot?.toLowerCase().includes(s) ?? false)
        );
      }
      return true;
    })
    .map((r) => {
      const qtyN = Number(r.quantity.toString());
      const resN = Number(r.reserved.toString());
      return {
        id: r.id,
        colourwayId: r.colourwayId,
        colourwayCode: r.colourway.code,
        colourName: r.colourway.colourName,
        designCode: r.colourway.design.code,
        family: r.colourway.design.family,
        dyeLot: r.dyeLot,
        quantity: r.quantity.toFixed(3),
        reserved: r.reserved.toFixed(3),
        available: (qtyN - resN).toFixed(3),
        binLocation: r.binLocation,
      };
    });
}

// ── Allocations ───────────────────────────────────────────────────────────────

export interface AllocationRow {
  id: string;
  orderLineId: string;
  colourwayId: string;
  colourwayCode: string;
  colourName: string;
  dyeLot: string | null;
  quantity: string;
  mixedLotOverride: boolean;
  overrideReason: string | null;
  createdAt: Date;
}

// ── Allocation candidates ─────────────────────────────────────────────────────
// Order lines with a colourwayId in non-terminal orders where allocated < needed.

export interface AllocationCandidateRow {
  orderLineId: string;
  lineNo: number;
  description: string;
  colourwayId: string;
  colourwayCode: string;
  colourName: string;
  family: string;
  unit: string;
  neededQty: string;
  allocatedQty: string;
  remainingQty: string;
  existingLot: string | null;
  orderNumber: string;
  orderStatus: string;
  clientName: string;
  rateStr: string; // BigInt paise as string — pass to allocateStock
}

export async function listAllocationCandidates(
  ctx: RequestContext,
): Promise<AllocationCandidateRow[]> {
  requirePermission(ctx, "stock.view");
  const db = scoped(ctx);

  const lines = await db.orderLine.findMany({
    where: {
      colourwayId: { not: null },
      order: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
    },
    orderBy: [{ order: { date: "desc" } }, { lineNo: "asc" }],
    take: 300,
    select: {
      id: true, lineNo: true, description: true, unit: true, quantity: true,
      colourwayId: true, rate: true,
      order: {
        select: {
          number: true, status: true,
          project: { select: { client: { select: { name: true } } } },
        },
      },
    },
  });

  if (lines.length === 0) return [];

  const lineIds = lines.map((l) => l.id);
  const colourwayIds = [...new Set(lines.map((l) => l.colourwayId!))];

  const [allocations, cws] = await Promise.all([
    db.allocation.findMany({
      where: { orderLineId: { in: lineIds } },
      select: { orderLineId: true, quantity: true, dyeLot: true },
    }),
    db.colourway.findMany({
      where: { id: { in: colourwayIds } },
      select: { id: true, code: true, colourName: true, design: { select: { family: true } } },
    }),
  ]);

  const allocByLine = new Map<string, { qty: Decimal; lot: string | null }>();
  for (const a of allocations) {
    const cur = allocByLine.get(a.orderLineId);
    if (cur) {
      cur.qty = cur.qty.plus(new Decimal(a.quantity.toString()));
    } else {
      allocByLine.set(a.orderLineId, { qty: new Decimal(a.quantity.toString()), lot: a.dyeLot });
    }
  }

  const cwMap = new Map(cws.map((c) => [c.id, c]));

  return lines
    .map((l) => {
      const cw = cwMap.get(l.colourwayId!);
      const allocInfo = allocByLine.get(l.id) ?? { qty: new Decimal(0), lot: null };
      const needed = new Decimal(l.quantity.toString());
      const remaining = needed.minus(allocInfo.qty);
      return {
        orderLineId:  l.id,
        lineNo:       l.lineNo,
        description:  l.description,
        colourwayId:  l.colourwayId!,
        colourwayCode: cw?.code ?? "—",
        colourName:   cw?.colourName ?? "—",
        family:       cw?.design.family ?? "—",
        unit:         l.unit,
        neededQty:    needed.toFixed(3),
        allocatedQty: allocInfo.qty.toFixed(3),
        remainingQty: remaining.toFixed(3),
        existingLot:  allocInfo.lot,
        orderNumber:  l.order.number,
        orderStatus:  l.order.status,
        clientName:   l.order.project.client.name,
        rateStr:      l.rate.toString(),
      };
    })
    .filter((r) => parseFloat(r.remainingQty) > 0.001);
}

export async function listAllocations(
  ctx: RequestContext,
  q: { orderLineId?: string; colourwayId?: string } = {},
): Promise<AllocationRow[]> {
  requirePermission(ctx, "stock.view");
  const db = scoped(ctx);

  const rows = await db.allocation.findMany({
    where: {
      ...(q.orderLineId ? { orderLineId: q.orderLineId } : {}),
      ...(q.colourwayId ? { colourwayId: q.colourwayId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  if (rows.length === 0) return [];

  // Colourway is not a Prisma relation on Allocation — fetch separately
  const cwIds = [...new Set(rows.map((r) => r.colourwayId))];
  const cws = await db.colourway.findMany({
    where: { id: { in: cwIds } },
    select: { id: true, code: true, colourName: true },
  });
  const cwMap = new Map(cws.map((c) => [c.id, c]));

  return rows.map((r) => {
    const cw = cwMap.get(r.colourwayId);
    return {
      id: r.id,
      orderLineId: r.orderLineId,
      colourwayId: r.colourwayId,
      colourwayCode: cw?.code ?? r.colourwayId.slice(0, 8),
      colourName: cw?.colourName ?? "—",
      dyeLot: r.dyeLot,
      quantity: r.quantity.toFixed(3),
      mixedLotOverride: r.mixedLotOverride,
      overrideReason: r.overrideReason,
      createdAt: r.createdAt,
    };
  });
}
