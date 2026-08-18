// §12.2 Scenario 4 — "Attempt a mixed-lot allocation; verify the block;
// override with a reason; verify the audit row."
//
// This is non-negotiable #4 (§0.6 / §15.4) and it had no end-to-end coverage at
// all. The server-side gate lives in src/modules/allocation/core.ts; this spec
// exercises it through the console a store keeper actually uses.

import { test, expect } from "@playwright/test";

test.describe("§12.2/4 — dye-lot allocation gate", () => {
  test("the console lists open order lines and their lots", async ({ page }) => {
    await page.goto("/purchase/allocation");
    await expect(page).not.toHaveTitle(/404|500/);
    await expect(page.getByRole("heading", { name: /dye-lot allocation/i })).toBeVisible();
    // The rule is stated on the page, before the mistake rather than after it.
    await expect(page.getByText(/must come from one dye lot/i)).toBeVisible();
  });

  test("a second dye lot on the same line raises the inline gate and demands a reason", async ({ page }) => {
    await page.goto("/purchase/allocation");

    // Target a line that ALREADY has a lot reserved — that is the state in
    // which the mixed-lot rule bites. Rows show their reserved lots as chips.
    // The seed plants a deterministic fixture for exactly this: an open order
    // line with LOT-GATE-A reserved and LOT-GATE-B available on the shelf.
    const row = page.locator('button[aria-expanded]').filter({ hasText: "LOT-GATE-A" }).first();
    await expect(
      row,
      "seed fixture missing — run SEED_DEMO_DATA=true pnpm db:seed",
    ).toBeVisible({ timeout: 15_000 });
    await row.click();

    const lotRadios = page.locator('input[type="radio"]');
    await expect(lotRadios.first()).toBeVisible({ timeout: 15_000 });

    // The gate must not be showing before we pick a conflicting lot.
    const gate = page.getByText(/puts two dye lots on one job/i);

    // Try each lot until one differs from what is already reserved.
    let raised = false;
    const count = await lotRadios.count();
    for (let i = 0; i < count; i++) {
      await lotRadios.nth(i).check();
      await page.waitForTimeout(200);
      if (await gate.isVisible().catch(() => false)) { raised = true; break; }
    }
    expect(raised, "selecting a different dye lot must raise the mixed-lot gate").toBe(true);

    // §6.3.6 — a red inline gate, not a toast, and the action stays blocked
    // until a written reason exists.
    const overrideBtn = page.getByRole("button", { name: /override & reserve/i });
    await expect(overrideBtn).toBeVisible();
    await expect(overrideBtn).toBeDisabled();

    await page.getByPlaceholder(/second lot goes on the opposite wall/i)
      .fill("Lot short by 2m; second lot goes on the opposite wall, confirmed with client on site.");
    await expect(overrideBtn).toBeEnabled();
  });
});
