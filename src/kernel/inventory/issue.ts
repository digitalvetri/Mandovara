// Stock issue — deducts quantity from StockBalance and appends a StockMove.
// Used by the Make module (Phase 5) to record fabric issued to a tailor,
// and by the Install module for material taken to site. Uses SELECT FOR
// UPDATE to serialise concurrent issues for the same lot.
//
// Returns a ReorderCrossing so the caller can publish `stock.belowReorder`
// AFTER commit if the SKU dropped through its threshold on this issue.
// See kernel/inventory/reorder.ts — the doc contract is: caller opens the
// transaction, calls issueStock inside it, then calls
// emitBelowReorderIfCrossed(...) after the transaction returns.

import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { TxClient } from "@/kernel/db/transaction";
import { checkReorderCrossing, type ReorderCrossing } from "./reorder";

export class NegativeStockError extends Error {
  constructor(
    readonly colourwayId: string,
    readonly requested: string,
    readonly available: string,
  ) {
    super(`Cannot issue ${requested} of colourway ${colourwayId}: only ${available} available`);
    this.name = "NegativeStockError";
  }
}

export interface IssueStockParams {
  organizationId: string;
  colourwayId:    string;
  dyeLot:         string | null;
  quantity:       Decimal;
  rate:           bigint;
  /**
   * The StockMove enum type — MAKE for tailor issues, SITE for install
   * pickups. Required (no default) so the install path can't silently log
   * as MAKE.
   */
  type:           "ISSUE_TO_MAKE" | "ISSUE_TO_SITE";
  refType:        string;   // "MAKE_JOB" | "INSTALL" | "TEST"
  refId:          string;
  createdById:    string;
  occurredAt:     Date;
}

export async function issueStock(
  tx: TxClient,
  params: IssueStockParams,
): Promise<ReorderCrossing> {
  const {
    organizationId, colourwayId, dyeLot, quantity,
    rate, type, refType, refId, createdById, occurredAt,
  } = params;

  const lotFilter =
    dyeLot !== null
      ? Prisma.sql`"dyeLot" = ${dyeLot}`
      : Prisma.sql`"dyeLot" IS NULL`;

  const locked = await tx.$queryRaw<{ id: string; quantity: string; reserved: string }[]>(
    Prisma.sql`
      SELECT "id", "quantity"::text, "reserved"::text
      FROM "StockBalance"
      WHERE "organizationId" = ${organizationId}
        AND "colourwayId" = ${colourwayId}
        AND ${lotFilter}
      FOR UPDATE
    `,
  );

  const available =
    locked.length > 0
      ? new Decimal(locked[0]!.quantity).minus(new Decimal(locked[0]!.reserved))
      : new Decimal(0);

  if (locked.length === 0 || quantity.gt(available)) {
    throw new NegativeStockError(colourwayId, quantity.toString(), available.toString());
  }

  await tx.stockMove.create({
    data: {
      organizationId,
      colourwayId,
      dyeLot,
      type,
      quantity,
      rate,
      refType,
      refId,
      occurredAt,
      createdById,
    },
  });

  await tx.stockBalance.update({
    where: { id: locked[0]!.id },
    data: { quantity: { decrement: quantity } },
  });

  // Signed applied delta: an issue is outward, so netDelta = −quantity.
  return checkReorderCrossing(tx, colourwayId, quantity.negated());
}
