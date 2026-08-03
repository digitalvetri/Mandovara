// Session 6 gate — 1,000 parallel invoice-number allocations produce zero
// gaps and zero duplicates. Uses the real Postgres database (docker-compose).

import { beforeAll, describe, expect, it } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { allocateNumber } from "@/kernel/numbering/series";
import { setupTwoTenants, type Tenant } from "../fixtures";
let A: Tenant;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
});

describe("numbering — 1,000 parallel allocations", () => {
  it("no gaps, no duplicates, monotonic 1..1000", async () => {
    const N = 1000;

    // Each allocation runs in its OWN transaction — matches the real usage,
    // where the caller wraps their document-write in withTransaction() and
    // calls allocateNumber(tx, ...) somewhere in the middle.
    // maxWait/timeout are raised because we're fanning out 1000 concurrent
    // txs against a shared row lock — realistic production concurrency is
    // <<1000 but this test intentionally maximises contention on the sequence.
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        db.$transaction(
          async (tx) => {
            return allocateNumber(tx, {
              orgId: A.orgId,
              branchId: A.branchId,
              docType: "INVOICE",
              financialYear: "26-27",
              prefix: "MDV/CBE/INV",
              padding: 5,
            });
          },
          { maxWait: 60_000, timeout: 60_000 },
        ),
      ),
    );

    // Every allocation returned successfully.
    expect(results).toHaveLength(N);

    // Extract the numeric part.
    const numbers = results.map((s) => {
      const tail = s.split("/").pop();
      if (!tail) throw new Error(`no numeric tail on ${s}`);
      return Number(tail);
    });

    // Zero duplicates.
    expect(new Set(numbers).size).toBe(N);

    // Range 1..1000 exactly — proves zero gaps.
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    expect(min).toBe(1);
    expect(max).toBe(N);
    const sum = numbers.reduce((s, n) => s + n, 0);
    expect(sum).toBe((N * (N + 1)) / 2); // 500_500 for N=1000

    // Format check.
    for (const s of results.slice(0, 5)) {
      expect(s).toMatch(/^MDV\/CBE\/INV\/26-27\/\d{5}$/);
    }

    // Row state matches: currentValue = N
    const row = await db.numberingSeries.findUniqueOrThrow({
      where: {
        orgId_branchId_docType_financialYear: {
          orgId: A.orgId, branchId: A.branchId,
          docType: "INVOICE", financialYear: "26-27",
        },
      },
    });
    expect(row.currentValue).toBe(BigInt(N));
  }, 60_000);
});
