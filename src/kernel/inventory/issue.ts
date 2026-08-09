// Stock issue — deducts quantity from StockBalance and appends a StockMove.
// Used by the Make module (Phase 5) to record fabric issued to a tailor.
// Uses SELECT FOR UPDATE to serialise concurrent issues for the same lot.

import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { TxClient } from "@/kernel/db/transaction";

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
  refType:        string;   // "MAKE_JOB" | "INSTALL" | "TEST"
  refId:          string;
  createdById:    string;
  occurredAt:     Date;
}

export async function issueStock(tx: TxClient, params: IssueStockParams): Promise<void> {
  const {
    organizationId, colourwayId, dyeLot, quantity,
    rate, refType, refId, createdById, occurredAt,
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
      type: "ISSUE_TO_MAKE",
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
}
