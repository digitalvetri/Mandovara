// postGrnToBalance — writes a GRN_IN StockMove and upserts the StockBalance.
// Called from grn-actions.ts inside the GRN transaction.
//
// Pattern:
//   1. Append StockMove(GRN_IN) — append-only ledger (DB trigger blocks UPDATE/DELETE).
//   2. SELECT ... FOR UPDATE on matching StockBalance to serialise concurrent GRNs.
//   3. UPDATE quantity+value if the row exists, INSERT otherwise.

import { Prisma } from "@prisma/client";
import type { Decimal } from "@prisma/client/runtime/library";
import type { TxClient } from "@/kernel/db/transaction";
import { qtyPaise } from "@/modules/stock/lib";

export interface PostGrnBalanceParams {
  organizationId: string;
  colourwayId: string;
  dyeLot: string | null;
  quantity: Decimal;
  rate: bigint;
  grnId: string;
  createdById: string;
  occurredAt: Date;
}

export async function postGrnToBalance(
  tx: TxClient,
  params: PostGrnBalanceParams,
): Promise<void> {
  const {
    organizationId, colourwayId, dyeLot, quantity, rate,
    grnId, createdById, occurredAt,
  } = params;
  const valuePaise = qtyPaise(quantity, rate);

  // Append-only ledger row
  await tx.stockMove.create({
    data: {
      organizationId,
      colourwayId,
      dyeLot,
      type: "GRN_IN",
      quantity,
      rate,
      refType: "GRN",
      refId: grnId,
      occurredAt,
      createdById,
    },
  });

  // Lock existing balance row (if any) to serialise concurrent GRNs for the same lot
  const lotFilter =
    dyeLot !== null
      ? Prisma.sql`"dyeLot" = ${dyeLot}`
      : Prisma.sql`"dyeLot" IS NULL`;

  const locked = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT "id"
      FROM "StockBalance"
      WHERE "organizationId" = ${organizationId}
        AND "colourwayId" = ${colourwayId}
        AND ${lotFilter}
      FOR UPDATE
    `,
  );

  if (locked.length > 0) {
    await tx.stockBalance.update({
      where: { id: locked[0]!.id },
      data: {
        quantity: { increment: quantity },
        value:    { increment: valuePaise },
      },
    });
  } else {
    await tx.stockBalance.create({
      data: {
        organizationId,
        colourwayId,
        ...(dyeLot !== null ? { dyeLot } : {}),
        quantity,
        value: valuePaise,
      },
    });
  }
}
