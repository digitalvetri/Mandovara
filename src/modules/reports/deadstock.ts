// Dead stock by dye lot report.
// Dead stock = dye-lot-tracked stock (quantity − reserved > 0) that has
// not moved for ≥ 90 days. Dye-lot items are most at risk because they
// cannot be mixed and are often project-specific.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { Decimal } from "@prisma/client/runtime/library";

export interface DeadStockRow {
  colourwayId:   string;
  sku:           string;
  colourName:    string;
  brandName:     string;
  designName:    string;
  dyeLot:        string;
  available:     string;   // quantity − reserved (Decimal string)
  valueStr:      string;   // BigInt paise as string
  lastMovedDays: number;
}

export async function listDeadStockReport(
  ctx:          RequestContext,
  stallDays = 90,
): Promise<DeadStockRow[]> {
  requirePermission(ctx, "report.view.projects");
  const db          = scoped(ctx);
  const cutoff      = new Date(Date.now() - stallDays * 86_400_000);

  const balances = await db.stockBalance.findMany({
    where: {
      organizationId: ctx.orgId,
      dyeLot:         { not: null },
      updatedAt:      { lt: cutoff },
    },
    select: {
      quantity:    true,
      reserved:    true,
      value:       true,
      dyeLot:      true,
      updatedAt:   true,
      colourway: {
        select: {
          code:       true,
          colourName: true,
          design: {
            select: {
              name:  true,
              collection: {
                select: { brand: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "asc" },
    take:    100,
  });

  const rows: DeadStockRow[] = [];
  for (const b of balances) {
    const available = new Decimal(b.quantity.toString()).sub(b.reserved.toString());
    if (available.lte(0)) continue; // nothing actually available

    const daysSince = Math.floor((Date.now() - b.updatedAt.getTime()) / 86_400_000);
    rows.push({
      colourwayId:   b.colourway.code,
      sku:           b.colourway.code,
      colourName:    b.colourway.colourName,
      brandName:     b.colourway.design.collection.brand.name,
      designName:    b.colourway.design.name,
      dyeLot:        b.dyeLot!,
      available:     available.toString(),
      valueStr:      b.value.toString(),
      lastMovedDays: daysSince,
    });
  }
  return rows;
}
