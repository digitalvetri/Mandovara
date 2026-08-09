// §12.2 Scenario 4 — Attempt a mixed-lot allocation; verify the block; override
// with a reason; verify the audit row.
//
// The server-side block (MixedLotError) and the Allocation row creation are
// tested in tests/unit/stock-allocation.test.ts and
// tests/kernel/concurrency/stock-allocation.test.ts.
//
// This E2E spec verifies the AllocationConsole UI:
//   - The mixed-lot warning gate renders in the browser
//   - The override checkbox and reason input appear when lots differ
//   - The error message matches "Mixed-lot allocation blocked"
//
// E2E_MIXED_LOT_ORDER_LINE — orderLineId that already has a dye-lot allocation,
//   used to trigger the mixed-lot scenario in the allocation console.

import { test, expect } from "@playwright/test";

const MIXED_LOT_ORDER_LINE = process.env["E2E_MIXED_LOT_ORDER_LINE"];

test("allocation console renders — pending lines or all-clear", async ({ page }) => {
  await page.goto("/purchase/allocation");
  await expect(page).not.toHaveTitle(/404|500/);

  const allClear = page.getByText(/all order lines are allocated/i);
  const table    = page.getByRole("table");
  await expect(allClear.or(table)).toBeVisible();
});

test("mixed-lot gate — warning panel renders when different lot selected", async ({ page }) => {
  test.skip(
    !MIXED_LOT_ORDER_LINE,
    "E2E_MIXED_LOT_ORDER_LINE not set — set to an orderLineId that already has a dye-lot " +
    "allocation to trigger the mixed-lot gate in the UI.",
  );

  await page.goto("/purchase/allocation");
  await expect(page).not.toHaveTitle(/404|500/);

  // Open the allocation panel for the target order line
  // The row is identified by the order line; click Allocate to expand
  const allocateBtn = page.getByRole("button", { name: /allocate/i }).first();
  await expect(allocateBtn).toBeVisible();
  await allocateBtn.click();

  // Type a DIFFERENT dye lot from the existing one to trigger the mixed-lot gate
  const dyeLotInput = page.getByLabel(/dye lot/i);
  await expect(dyeLotInput).toBeVisible();
  await dyeLotInput.fill("DIFFERENT-LOT-99");

  // The mixed-lot warning should now be visible (§6.3: "red inline gate, not a toast")
  await expect(page.getByText(/mixed-lot allocation/i)).toBeVisible();
  await expect(page.getByText(/visible colour difference/i)).toBeVisible();

  // The override checkbox should appear
  const overrideCheckbox = page.getByRole("checkbox", { name: /accept the mixed-lot risk/i });
  await expect(overrideCheckbox).toBeVisible();

  // Submit without checking override → blocked
  await page.getByRole("button", { name: /confirm allocation/i }).click();
  await expect(page.getByText(/mixed-lot allocation blocked/i)).toBeVisible();

  // Check override + provide reason → should succeed
  await overrideCheckbox.check();
  const reasonInput = page.getByPlaceholder(/reason:/i);
  await expect(reasonInput).toBeVisible();
  await reasonInput.fill("E2E: client approved shade variation from same production run");
  await page.getByRole("button", { name: /confirm allocation/i }).click();

  // After success the form closes (panel collapses or shows confirmation)
  await expect(page.getByText(/mixed-lot allocation blocked/i)).not.toBeVisible({ timeout: 5000 });
});

// Note: the Allocation row audit (mixedLotOverride=true, overrideReason, overrideById) is
// verified server-side in tests/unit/stock-allocation.test.ts.
// DB-level append-only enforcement for StockMove is in tests/kernel/stock-append-only.test.ts.
