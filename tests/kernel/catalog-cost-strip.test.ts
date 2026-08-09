// @ts-nocheck
// §12.2 Scenario 6 — real-DB gate: searchDesigns strips COST prices for roles
// that lack catalog.viewCost.
//
// This test proves the SECURITY PROPERTY, not just the logic of can():
// if someone deletes `tier: showCost ? undefined : { not: "COST" }` from
// searchDesigns, this test goes RED for INSTALLER. The permission-registry
// tests in tests/integration/s6-rbac-cost-strip.test.ts are complementary
// (they verify the logic path) but this is the authoritative gate.
//
// Requires DATABASE_URL to be set. Runs under Vitest (not Playwright).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { searchDesigns } from "@/modules/catalog/queries";
import type { RequestContext } from "@/kernel/auth/context";

const db = new PrismaClient();

// Unique suffix per test run to avoid collisions with parallel test workers
const SUFFIX = Math.random().toString(36).slice(2, 8).toUpperCase();

let orgId: string;

function makeCtx(perms: string[]): RequestContext {
  return {
    userId:      "test-user",
    orgId,                           // set in beforeAll
    branchIds:   [],
    branchScope: "ALL",
    roles:       ["test"],
    permissions: new Set(perms) as unknown as RequestContext["permissions"],
  };
}

// ── Seed ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const org = await db.organization.create({
    data: { name: `CostStrip-${SUFFIX}`, settings: {} },
  });
  orgId = org.id;

  const brand = await db.brand.create({
    data: { organizationId: orgId, name: `Brand-${SUFFIX}` },
  });

  const collection = await db.collection.create({
    data: {
      organizationId: orgId,
      brandId:        brand.id,
      name:           `Col-${SUFFIX}`,
      family:         "CURTAIN_FABRIC",
    },
  });

  const design = await db.design.create({
    data: {
      organizationId: orgId,
      collectionId:   collection.id,
      code:           `D-${SUFFIX}`,
      name:           `Fabric ${SUFFIX}`,
      family:         "CURTAIN_FABRIC",
      hsn:            "5407",
      gstRate:        12,
      specs:          {},
    },
  });

  const colourway = await db.colourway.create({
    data: {
      organizationId: orgId,
      designId:       design.id,
      code:           `CW-${SUFFIX}`,
      colourName:     "White",
      sellUnit:       "METRE",
    },
  });

  // COST price — should be invisible to INSTALLER
  await db.price.create({
    data: {
      organizationId: orgId,
      colourwayId:    colourway.id,
      tier:           "COST",
      amount:         BigInt(50_000),       // ₹500 in paise
      effectiveFrom:  new Date("2020-01-01"),
    },
  });

  // RETAIL price — should be visible to everyone
  await db.price.create({
    data: {
      organizationId: orgId,
      colourwayId:    colourway.id,
      tier:           "RETAIL",
      amount:         BigInt(120_000),      // ₹1200 in paise
      effectiveFrom:  new Date("2020-01-01"),
    },
  });
});

afterAll(async () => {
  // Cascade deletes via FK — delete org last
  if (orgId) {
    await db.$executeRawUnsafe(
      `DELETE FROM "Organization" WHERE id = $1`, orgId,
    );
  }
  await db.$disconnect();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("searchDesigns cost-stripping gate (real DB)", () => {
  const params = { q: SUFFIX, page: 1, pageSize: 10 };

  it("COST data EXISTS in the DB (proves the following assertions are non-trivial)", async () => {
    const row = await db.price.findFirst({
      where: { tier: "COST", colourway: { organizationId: orgId } },
    });
    expect(row).not.toBeNull();
  });

  it("INSTALLER ctx (no catalog.viewCost): COST price absent, RETAIL visible", async () => {
    const ctx = makeCtx(["catalog.view"]);           // deliberate: no viewCost
    const { designs } = await searchDesigns(ctx, params);

    const allPrices = designs.flatMap((d) => d.colourways.flatMap((cw) => cw.prices));
    expect(allPrices.length).toBeGreaterThan(0);     // found something

    const costPrices = allPrices.filter((p) => p.tier === "COST");
    expect(costPrices, "INSTALLER must not see COST tier").toHaveLength(0);

    const retailPrices = allPrices.filter((p) => p.tier === "RETAIL");
    expect(retailPrices.length, "INSTALLER must see RETAIL tier").toBeGreaterThan(0);
  });

  it("OWNER ctx (has catalog.viewCost): COST price IS visible", async () => {
    const ctx = makeCtx(["catalog.view", "catalog.viewCost"]);
    const { designs } = await searchDesigns(ctx, params);

    const allPrices = designs.flatMap((d) => d.colourways.flatMap((cw) => cw.prices));
    const costPrices = allPrices.filter((p) => p.tier === "COST");
    expect(costPrices.length, "OWNER must see COST tier").toBeGreaterThan(0);
  });

  it("ACCOUNTS ctx (has catalog.viewCost): COST price IS visible", async () => {
    const ctx = makeCtx(["catalog.view", "catalog.viewCost"]);
    const { designs } = await searchDesigns(ctx, params);

    const allPrices = designs.flatMap((d) => d.colourways.flatMap((cw) => cw.prices));
    const costPrices = allPrices.filter((p) => p.tier === "COST");
    expect(costPrices.length, "ACCOUNTS must see COST tier").toBeGreaterThan(0);
  });
});
