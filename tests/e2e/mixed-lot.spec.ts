// §12.2 acceptance #4 — "Attempt a mixed-lot allocation; verify
// the block; override with a reason; verify the audit row."
//
// The concurrency + audit invariants are already proven at the
// server-actions level by scripts/smoke-mixed-lot-audit.ts. This
// spec exercises the UI wiring at /purchase/allocation to prove
// the operator's flow and the visible refusal / override.

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  seedMixedLotFixture, cleanupMixedLotFixture,
  type MixedLotFixture,
} from "./_fixtures/mixed-lot";

let fx: MixedLotFixture;

test.beforeAll(async () => {
  fx = await seedMixedLotFixture();
});
test.afterAll(async () => {
  if (fx) await cleanupMixedLotFixture(fx);
});

test("§12.2 #4 — mixed-lot allocation gate + audited override", async ({ page }) => {
  await page.goto(`/purchase/allocation?line=${fx.orderLineId}`);

  // The existing LOT-A allocation is rendered — assert visible.
  await expect(page.getByText(/E2E-\d+-LOT-A/).first()).toBeVisible({ timeout: 10_000 });

  // The available-lots list shows LOT-B with a "different lot —
  // would mix" pill. Click that row to select it.
  const lotBRow = page.locator("li").filter({ hasText: /E2E-\d+-LOT-B/ }).first();
  await lotBRow.click();

  // Client-side warning renders immediately (wouldBeMixed=true).
  // devContext grants allocation.overrideMixedLot so the reason
  // textarea (not the "blocked" banner) is what appears.
  await expect(page.getByText(/override required/i)).toBeVisible({ timeout: 5_000 });

  // Fill reason + qty.
  await page.getByPlaceholder(/Reason for the mixed-lot/i)
    .fill("E2E: client approved shade drift");
  await page.locator('input[inputmode="decimal"]').fill("1");

  // Submit — button label morphs to "Allocate with override" when
  // wouldBeMixed=true.
  await page.getByRole("button", { name: /Allocate with override/i }).click();

  // Router refreshes; LOT-B allocation appears with the
  // "mixed-lot override" chip.
  await expect(page.getByText(/mixed-lot override/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/E2E-\d+-LOT-B/).first()).toBeVisible();

  // Audit row check — the action layer writes CREATE_MIXED_LOT.
  const db = new PrismaClient();
  try {
    const audit = await db.auditLog.findFirst({
      where: {
        entityType: "LotAllocation",
        action:     "CREATE_MIXED_LOT",
        after:      { path: ["overrideReason"], string_contains: "E2E" },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
  } finally {
    await db.$disconnect();
  }
});
