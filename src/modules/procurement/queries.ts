// Procurement console query — per-project view of what each order line
// needs, what's already procured, what's on hand, and what shortfall
// remains. Feeds /projects/[id]/procurement.

import type { RequestContext } from "@/kernel/auth/context";
import { scoped } from "@/kernel/db/scoped";

export interface ProcurementRow {
  orderLineId:     string;
  lineNo:          number;
  description:     string;
  unit:            string;
  quantityNeeded:  string;
  procuredQty:     string;
  onHandTotal:     string;
  shortfall:       string;
  colourwayId:     string | null;
  colourwayCode:   string | null;
  colourName:      string | null;
  designCode:      string | null;
  family:          string | null;
  stockByLot:      { dyeLot: string | null; available: string }[];
}

export interface ProcurementConsoleData {
  order:      { id: string; number: string; status: string } | null;
  rows:       ProcurementRow[];
  hasStock:   boolean;
  hasShortfall: boolean;
}

export async function getProjectProcurement(
  ctx: RequestContext,
  projectId: string,
): Promise<ProcurementConsoleData> {
  const db = scoped(ctx);

  const order = await db.order.findFirst({
    where:   { projectId, status: { not: "CANCELLED" } },
    orderBy: { date: "desc" },
    select:  {
      id: true, number: true, status: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          id: true, lineNo: true, description: true, unit: true,
          quantity: true, procuredQty: true, colourwayId: true,
          colourway: {
            select: {
              code: true, colourName: true,
              design: { select: { code: true, family: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return { order: null, rows: [], hasStock: false, hasShortfall: false };
  }

  const colourwayIds = order.lines
    .map((l) => l.colourwayId)
    .filter((id): id is string => id != null);

  // Batch the stock lookup — one query for all colourways in the order.
  const balances = colourwayIds.length === 0
    ? []
    : await db.stockBalance.findMany({
        where:   { colourwayId: { in: colourwayIds }, quantity: { gt: 0 } },
        select:  { colourwayId: true, dyeLot: true, quantity: true, reserved: true },
      });

  const byColourway = new Map<string, { dyeLot: string | null; available: number }[]>();
  for (const b of balances) {
    const qty = Number(b.quantity.toString());
    const res = Number(b.reserved.toString());
    const arr = byColourway.get(b.colourwayId) ?? [];
    arr.push({ dyeLot: b.dyeLot, available: qty - res });
    byColourway.set(b.colourwayId, arr);
  }

  const rows: ProcurementRow[] = order.lines.map((l) => {
    const needed   = Number(l.quantity.toString());
    const procured = Number(l.procuredQty.toString());
    const lots     = l.colourwayId ? byColourway.get(l.colourwayId) ?? [] : [];
    const onHand   = lots.reduce((s, x) => s + x.available, 0);
    const shortfall = Math.max(0, needed - procured - onHand);
    return {
      orderLineId:    l.id,
      lineNo:         l.lineNo,
      description:    l.description,
      unit:           l.unit,
      quantityNeeded: needed.toFixed(3),
      procuredQty:    procured.toFixed(3),
      onHandTotal:    onHand.toFixed(3),
      shortfall:      shortfall.toFixed(3),
      colourwayId:    l.colourwayId,
      colourwayCode:  l.colourway?.code ?? null,
      colourName:     l.colourway?.colourName ?? null,
      designCode:     l.colourway?.design.code ?? null,
      family:         l.colourway?.design.family ?? null,
      stockByLot:     lots.map((x) => ({ dyeLot: x.dyeLot, available: x.available.toFixed(3) })),
    };
  });

  return {
    order: { id: order.id, number: order.number, status: order.status },
    rows,
    hasStock:     rows.some((r) => Number(r.onHandTotal) > 0),
    hasShortfall: rows.some((r) => Number(r.shortfall) > 0),
  };
}
