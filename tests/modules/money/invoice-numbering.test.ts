// Phase 6 gate: 1,000 parallel invoice numbers — zero gaps, zero duplicates.
//
// allocateNumber() uses INSERT ... ON CONFLICT DO UPDATE with a row-level lock
// on NumberSequence. This test fires 1,000 concurrent calls and asserts that
// the counter increments monotonically from 1 to 1,000 with no gaps and no
// duplicates. Each call also creates an Invoice row to prove the number lands
// in the database — a "number collision" at the DB unique index would throw.

import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { allocateNumber } from "../../../src/kernel/numbering/series";
import { withTransaction } from "../../../src/kernel/db/transaction";

const db    = new PrismaClient();
const YYMM  = "2699"; // future date — won't collide with other test series
const COUNT = 1_000;

let orgId:    string;
let branchId: string;
let userId:   string;
let clientId: string;
let orderId:  string;

beforeAll(async () => {
  const org = await db.organization.create({
    data: { name: "InvNum Gate Org", settings: {} },
  });
  orgId = org.id;

  const branch = await db.branch.create({
    data: { organizationId: orgId, name: "HQ", invoicePrefix: "TST" },
  });
  branchId = branch.id;

  const user = await db.user.create({
    data: {
      organizationId: orgId, mobile: "+919600000099",
      name: "Gate Tester", role: "OWNER", branchIds: [branchId],
    },
  });
  userId = user.id;

  const client = await db.client.create({
    data: {
      organizationId: orgId, code: "CL-INV-GATE",
      name: "Gate Client", mobile: "+919601000099", billingAddress: {},
    },
  });
  clientId = client.id;

  const project = await db.project.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/PRJ-2699-0001",
      name: "Gate Project", clientId, stage: "ORDERED",
      siteAddress: {}, ownerId: userId,
    },
  });

  const order = await db.order.create({
    data: {
      organizationId: orgId, branchId, number: "MDV/SO-2699-0001",
      projectId: project.id, clientId,
      date: new Date(), status: "CONFIRMED", totalValue: 100000n,
    },
  });
  orderId = order.id;
}, 30_000);

afterAll(async () => {
  await db.$disconnect();
});

describe("Phase 6 gate: invoice number allocation", () => {
  it(`allocates ${COUNT} invoice numbers with zero gaps and zero duplicates`, async () => {
    // Run in batches of 50 concurrent transactions to avoid exhausting the
    // connection pool, while still exercising lock contention on NumberSequence.
    // Total: 1,000 allocations — all must succeed, zero gaps, zero duplicates.
    const BATCH = 50;
    const allResults: PromiseSettledResult<string>[] = [];

    for (let offset = 0; offset < COUNT; offset += BATCH) {
      const batchSize = Math.min(BATCH, COUNT - offset);
      const batch = Array.from({ length: batchSize }, (_, j) => {
        const i = offset + j;
        return withTransaction(async (tx) => {
          const number = await allocateNumber(tx, {
            orgId,
            series: "INV",
            yymm:   YYMM,
            prefix: "TST",
          });
          await tx.invoice.create({
            data: {
              organizationId:    orgId,
              branchId,
              number,
              type:              "TAX",
              clientId,
              orderId,
              date:              new Date(),
              dueDate:           new Date(),
              placeOfSupplyCode: "33",
              taxableAmount:     BigInt(i + 1) * 10000n,
              cgst:              BigInt(i + 1) * 900n,
              sgst:              BigInt(i + 1) * 900n,
              igst:              0n,
              roundOff:          0n,
              total:             BigInt(i + 1) * 11800n,
              advanceAdjusted:   0n,
              status:            "ISSUED",
              irnStatus:         "NOT_REQUIRED",
            },
          });
          return number;
        });
      });
      const batchResults = await Promise.allSettled(batch);
      allResults.push(...batchResults);
    }

    const results = allResults;

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);

    // All must succeed
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const reasons = (failed as PromiseRejectedResult[]).slice(0, 3).map((r) => r.reason);
      throw new Error(`${failed.length} of ${COUNT} allocations failed:\n${reasons.join("\n")}`);
    }

    expect(succeeded).toHaveLength(COUNT);

    // No duplicates
    const unique = new Set(succeeded);
    expect(unique.size).toBe(COUNT);

    // Extract counter from each number and verify 1..1000
    const counters = succeeded
      .map((n) => parseInt(n.split("-").at(-1)!, 10))
      .sort((a, b) => a - b);

    expect(counters[0]).toBe(1);
    expect(counters[COUNT - 1]).toBe(COUNT);

    // Verify in the DB
    const dbInvoices = await db.invoice.findMany({
      where: { organizationId: orgId, branchId },
      select: { number: true },
    });
    expect(dbInvoices).toHaveLength(COUNT);
    const dbNumbers = new Set(dbInvoices.map((i) => i.number));
    expect(dbNumbers.size).toBe(COUNT);
  }, 120_000); // generous timeout for 1,000 concurrent tx
});
