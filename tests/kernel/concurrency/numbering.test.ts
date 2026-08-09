// @ts-nocheck
// Gate: 1,000 parallel number allocations produce zero gaps and zero duplicates.
// Uses the real Postgres database via the Mandovara NumberSequence model.

import { beforeAll, describe, expect, it } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { allocateNumber } from "@/kernel/numbering/series";
import { setupTwoTenants, type Tenant } from "../fixtures";

let A: Tenant;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
});

describe("numbering - 1,000 parallel allocations", () => {
  it("no gaps, no duplicates, monotonic 1..1000", async () => {
    const N = 1000;

    const results = await Promise.all(
      Array.from({ length: N }, () =>
        db.$transaction(
          async (tx) => {
            return allocateNumber(tx, {
              orgId: A.orgId,
              series: "INV",
              yymm: "2608",
              prefix: "MDV",
              padding: 5,
            });
          },
          { maxWait: 60_000, timeout: 60_000 },
        ),
      ),
    );

    expect(results).toHaveLength(N);

    // Extract the numeric counter from the last segment: "MDV/INV-2608-00042" -> 42
    const numbers = results.map((s) => {
      const tail = s.split("-").pop();
      if (!tail) throw new Error(`no numeric tail on ${s}`);
      return Number(tail);
    });

    // Zero duplicates
    expect(new Set(numbers).size).toBe(N);

    // Range 1..1000 exactly — proves zero gaps
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    expect(min).toBe(1);
    expect(max).toBe(N);
    const sum = numbers.reduce((s, n) => s + n, 0);
    expect(sum).toBe((N * (N + 1)) / 2);

    // Format check: "MDV/INV-2608-00042"
    for (const s of results.slice(0, 5)) {
      expect(s).toMatch(/^MDV\/INV-2608-\d{5}$/);
    }

    // DB row counter = N
    const row = await db.numberSequence.findUniqueOrThrow({
      where: {
        organizationId_series_yymm: {
          organizationId: A.orgId,
          series: "INV",
          yymm: "2608",
        },
      },
    });
    expect(row.counter).toBe(N);
  }, 60_000);
});
