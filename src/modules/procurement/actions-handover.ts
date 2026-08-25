"use server";

// Batch C (25 Aug 2026) — bulk stock deduction fired when a HANDOVER
// site visit completes. Walks the order lines; for each colourway
// with an outstanding qty (needed − already-procured), consumes from
// StockBalance largest-lot-first and increments OrderLine.procuredQty.
// Best-effort per line: a shortage on one line does not block the
// others. Anything still short after this stays on the order line's
// procuredQty gap; the visit page surfaces a "Raise PO" link for those.

import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { orgPrisma } from "@/kernel/db/rls";
import { issueStock } from "@/kernel/inventory/issue";

interface Params {
  orderId: string;
  actorId: string;
  orgId:   string;
}

export async function deductStockForOrderOnHandover(
  params: Params,
): Promise<{ ok: boolean; deducted: number; shortages: number }> {
  const { orderId, actorId, orgId } = params;
  // orgPrisma bypasses the request-context scoping (there isn't one
  // in this internal, server-fired flow) but still pins the tenant
  // for RLS. Same pattern kernel/milestones/listeners.ts uses.
  const db = orgPrisma(orgId);

  const order = await db.order.findUnique({
    where:  { id: orderId },
    select: {
      id: true,
      lines: {
        select: {
          id: true, colourwayId: true, rate: true,
          quantity: true, procuredQty: true,
        },
      },
    },
  });
  if (!order) return { ok: false, deducted: 0, shortages: 0 };

  let deducted  = 0;
  let shortages = 0;

  for (const line of order.lines) {
    if (!line.colourwayId) continue;
    const needed    = new Decimal(line.quantity.toString());
    const procured  = new Decimal(line.procuredQty.toString());
    const remaining = needed.minus(procured);
    if (remaining.lte(0)) continue;

    // Look up available lots for this colourway.
    const lots = await db.stockBalance.findMany({
      where:   { colourwayId: line.colourwayId, quantity: { gt: 0 } },
      orderBy: { quantity: "desc" },
      select:  { dyeLot: true, quantity: true, reserved: true },
    });

    let toConsume = remaining;
    const plan: { dyeLot: string | null; take: Decimal }[] = [];
    for (const lot of lots) {
      const avail = new Decimal(lot.quantity.toString()).minus(new Decimal(lot.reserved.toString()));
      if (avail.lte(0)) continue;
      const take = Decimal.min(avail, toConsume);
      if (take.lte(0)) continue;
      plan.push({ dyeLot: lot.dyeLot, take });
      toConsume = toConsume.minus(take);
      if (toConsume.lte(0)) break;
    }

    if (plan.length === 0) {
      shortages += 1;
      continue;
    }

    try {
      const totalTaken = plan.reduce((s, p) => s.plus(p.take), new Decimal(0));
      await withTransaction(async (tx: TxClient) => {
        for (const step of plan) {
          await issueStock(tx, {
            organizationId: orgId,
            colourwayId:    line.colourwayId!,
            dyeLot:         step.dyeLot,
            quantity:       step.take,
            rate:           line.rate,
            type:           "ISSUE_TO_SITE",
            refType:        "ORDER",
            refId:          line.id,
            createdById:    actorId,
            occurredAt:     new Date(),
          });
        }
        await tx.orderLine.update({
          where: { id: line.id },
          data:  { procuredQty: { increment: totalTaken } },
        });
      }, { orgId });
      deducted += 1;
      if (toConsume.gt(0)) shortages += 1;
    } catch (err) {
      console.warn(`stock-deduct line ${line.id} failed:`, err);
      shortages += 1;
    }
  }

  return { ok: true, deducted, shortages };
}
