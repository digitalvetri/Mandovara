// Session 6 gate — 50 parallel stock issues of the same SKU NEVER oversell.
// Stock starts at 100 units. 50 issues of 3 units each = 150 total demand.
// At most 33 issues can succeed (99 units); the rest must fail cleanly with
// NegativeStockError. Final balance = 100 - (successes * 3), and it must
// never dip below 0 at any observable point.

import { beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma as db } from "@/kernel/db/client";
import { issueStock, NegativeStockError } from "@/kernel/inventory/issue";
import { setupTwoTenants, type Tenant } from "../fixtures";
let A: Tenant;
let warehouseId: string;
let productId: string;

const INITIAL_STOCK = 100;
const PARALLEL = 50;
const PER_ISSUE = 3;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  const category = await db.category.create({ data: { orgId: A.orgId, name: "cc" } });
  const product = await db.product.create({
    data: {
      orgId: A.orgId, categoryId: category.id, code: "CONC-SKU-1", name: "Concurrent Widget",
      hsn: "1234", uom: "NOS", gstRate: new Prisma.Decimal(18),
    },
  });
  const warehouse = await db.warehouse.create({
    data: { orgId: A.orgId, branchId: A.branchId, name: "concurrency-wh" },
  });
  await db.stockBalance.create({
    data: {
      orgId: A.orgId, warehouseId: warehouse.id, productId: product.id,
      quantity: new Prisma.Decimal(INITIAL_STOCK), value: BigInt(INITIAL_STOCK) * 100n,
    },
  });
  productId = product.id;
  warehouseId = warehouse.id;
});

describe("stock issue — 50 parallel issues never oversell", () => {
  it(`starts at ${INITIAL_STOCK}, tries ${PARALLEL}×${PER_ISSUE}, never dips below 0`, async () => {
    const results = await Promise.allSettled(
      Array.from({ length: PARALLEL }, (_, i) =>
        db.$transaction(
          async (tx) => {
            await issueStock(tx, {
              orgId: A.orgId, warehouseId, productId,
              quantity: PER_ISSUE, rate: 100n,
              refType: "TEST", refId: `test-${i}`,
            });
          },
          { maxWait: 60_000, timeout: 60_000 },
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.filter((r) => r.status === "rejected");
    const totalIssued = succeeded * PER_ISSUE;

    // Every failure must be a NegativeStockError — nothing else acceptable.
    for (const r of failed) {
      if (r.status !== "rejected") continue;
      const err = r.reason as unknown;
      const name = err instanceof Error ? err.name : String(err);
      const msg  = err instanceof Error ? err.message : String(err);
      expect(name).toBe("NegativeStockError");
      // Also confirm the error type is the one we exported (not a coincidence).
      expect(err).toBeInstanceOf(NegativeStockError);
      // Sanity — error should mention the product.
      expect(msg).toContain(productId);
    }

    // Zero oversell — succeeded × per-issue ≤ initial stock.
    expect(totalIssued).toBeLessThanOrEqual(INITIAL_STOCK);

    // Final stored balance matches what we issued.
    const balance = await db.stockBalance.findFirstOrThrow({
      where: { productId, warehouseId },
    });
    expect(balance.quantity.toString()).toBe((INITIAL_STOCK - totalIssued).toString());
    expect(Number(balance.quantity)).toBeGreaterThanOrEqual(0);

    // Every succeeded issue wrote a ledger row (append-only).
    const ledgerCount = await db.stockLedgerEntry.count({
      where: { productId, warehouseId, direction: "OUT", refType: "TEST" },
    });
    expect(ledgerCount).toBe(succeeded);
  }, 90_000);
});
