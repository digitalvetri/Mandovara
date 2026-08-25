// Live reservations against stock, computed on the fly. Owner canonical
// flow (2026-08-25) — picking a product on a firm quote should IMMEDIATELY
// reduce visible stock in /inventory. We don't materialize this as a
// StockMove; we sum over the source-of-truth rows every time the stock
// list is rendered so there's no drift to reconcile.
//
// Two sources:
//   1. QuotationLine on firm quotes (projectId set) with status in the
//      "still deciding" bucket (DRAFT, PENDING_APPROVAL, APPROVED, SENT).
//      Rough estimates on leads (leadId set, projectId null) do NOT
//      reserve — a lead may never convert.
//   2. OrderLine on non-terminal orders where procured qty < ordered qty.
//      The un-procured remainder is committed to that project.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";

const QUOTE_RESERVING_STATUSES = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT",
] as const;

const ORDER_RESERVING_STATUSES = [
  "DRAFT", "CONFIRMED", "PROCUREMENT", "MAKE",
] as const;

export interface Reservation {
  quotationReserved: number;
  orderReserved:     number;
  total:             number;
}

/** Zero when a colourwayId isn't in the map — callers can `?? {…}` safely. */
export async function computeReservations(
  ctx:          RequestContext,
  colourwayIds: string[],
): Promise<Map<string, Reservation>> {
  const result = new Map<string, Reservation>();
  if (colourwayIds.length === 0) return result;

  const db = scoped(ctx);

  const [quoteLines, orderLines] = await Promise.all([
    db.quotationLine.findMany({
      where: {
        colourwayId: { in: colourwayIds },
        quotation: {
          projectId: { not: null },
          status:    { in: [...QUOTE_RESERVING_STATUSES] },
        },
      },
      select: { colourwayId: true, quantity: true },
    }),
    db.orderLine.findMany({
      where: {
        colourwayId: { in: colourwayIds },
        order: {
          status: { in: [...ORDER_RESERVING_STATUSES] },
        },
      },
      select: { colourwayId: true, quantity: true, procuredQty: true },
    }),
  ]);

  for (const l of quoteLines) {
    if (!l.colourwayId) continue;
    const cur = result.get(l.colourwayId) ?? { quotationReserved: 0, orderReserved: 0, total: 0 };
    cur.quotationReserved += Number(l.quantity);
    cur.total = cur.quotationReserved + cur.orderReserved;
    result.set(l.colourwayId, cur);
  }
  for (const l of orderLines) {
    if (!l.colourwayId) continue;
    const remaining = Math.max(0, Number(l.quantity) - Number(l.procuredQty));
    if (remaining <= 0) continue;
    const cur = result.get(l.colourwayId) ?? { quotationReserved: 0, orderReserved: 0, total: 0 };
    cur.orderReserved += remaining;
    cur.total = cur.quotationReserved + cur.orderReserved;
    result.set(l.colourwayId, cur);
  }

  return result;
}
