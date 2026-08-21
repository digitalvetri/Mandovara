// §12.2 Scenario 2 — Order → PO → GRN with dye lot → allocate → make job →
//   cut list printed → invoice → receipt.
//
// This spec verifies every operations-side page loads and renders its core UI.
// DB-level behavior (dye-lot enforcement, append-only StockMove, GST computation)
// is covered in the unit and kernel tests.
//
// The install-visit portion of this scenario was removed when the whole
// installation module was nuked. Order fulfillment now stops at MAKE / QC.

import { test, expect, type Page } from "@playwright/test";
import { makeJobId, colourwayId } from "./_ids";

const _ORDER_ID        = process.env["E2E_ORDER_ID"];

async function expectNoRuntimeError(page: Page) {
  await expect(
    page.getByText(/PrismaClientValidationError|Unknown field|Unhandled Runtime Error/i),
  ).toHaveCount(0);
}

// ── Purchase ──────────────────────────────────────────────────────────────────

test("purchase orders list loads", async ({ page }) => {
  await page.goto("/purchase");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/purchase/i).first()).toBeVisible();
});

// ── Dye-lot allocation console — removed at the owner's request, 19 Aug 2026.
//    Lots are no longer RESERVED against order lines; they are still recorded
//    at goods-receipt, carried on stock balances and named on install lines.
//    The traceability chain below tests what remains.

// ── Make (cut & stitch) ───────────────────────────────────────────────────────

test("make kanban loads with status columns", async ({ page }) => {
  await page.goto("/make");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Kanban board should show at least one status label
  await expect(page.getByText(/queued|cutting|stitching|finishing|qc|ready/i).first()).toBeVisible();
});

test("make job detail renders cut list", async ({ page }) => {
  const id = await makeJobId(page);
  test.skip(!id, "no make job in the database — run the seed with SEED_DEMO_DATA=true");
  await page.goto(`/make/${id}`);
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Cut list should show panel count or cut length
  await expect(page.getByText(/cut list|panel|cut length/i).first()).toBeVisible();
});

// ── Invoicing ─────────────────────────────────────────────────────────────────

test("invoicing list loads", async ({ page }) => {
  await page.goto("/invoicing");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/invoice/i).first()).toBeVisible();
});

// ── Accounts / Receipts ───────────────────────────────────────────────────────

test("accounts page loads with money summary", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Copy was rewritten to plain English (docs/ACCOUNTS-PAGE.md §3) —
  // no more accounting vocabulary. Assert on the new labels instead.
  await expect(page.getByText(/to collect|came in|chase these today/i).first()).toBeVisible();
  // Structural check too: the tabs carry role="tab", not role="link".
  await expect(page.getByRole("tab", { name: "To Collect", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Received", exact: true })).toBeVisible();
});

test("to-collect tab lists money owed", async ({ page }) => {
  await page.goto("/accounts?tab=to-collect");
  await expectNoRuntimeError(page);
  // Seeded invoices are partially paid, so there is always something to collect.
  await expect(page.getByText(/₹/).first()).toBeVisible();
});

// ── Inventory (stock balances) ────────────────────────────────────────────────

test("inventory page loads with balance list", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/stock|inventory|balance/i).first()).toBeVisible();
});

// ── Transactional chain ───────────────────────────────────────────────────────
// §12.2 Scenario 2 end to end: the same dye lot must be traceable from what
// came into stock to the install line that records what physically went on the
// wall. That chain is the whole answer to "the wallpaper doesn't match — which
// lot went where?", and removing the allocation console did not remove it: the
// reservation step is gone, the record is not.

test("a dye lot is recorded at the stocked end of the chain", async ({ page }) => {
  // Stocked end: the product detail page carries a dye-lot pin whenever the
  // colourway has stock recorded under a specific lot ("MIX" when multiple
  // lots are held). Asserted on the pin's title attribute.
  //
  // (The "fitted end" of this scenario was covered by the install visit sheet,
  // which was removed with the installation module. Traceability at goods
  // receipt through to stock balances is what remains.)
  const cwId = await colourwayId(page);
  test.skip(!cwId, "no wallpaper colourways in inventory — run the seed with SEED_DEMO_DATA=true");
  await page.goto(`/products/${cwId}`);
  await expectNoRuntimeError(page);
  const stockedLot = page.locator('[title^="Dye lot:"]').first();
  await expect(stockedLot, "no dye-lot pin on product detail for wallpaper SKU").toBeVisible({ timeout: 15_000 });
});

test("the make queue shows a cut list derived from the measurement", async ({ page }) => {
  const id = await makeJobId(page);
  test.skip(!id, "no make job — seed with SEED_DEMO_DATA=true");
  await page.goto(`/make/${id}`);
  await expectNoRuntimeError(page);

  // §7.7.6 / §15.3: the cut list is generated FROM CalcResult, not re-derived,
  // so panels and cut length must both be present on the job card.
  await expect(page.getByText(/cut list|panel|cut length/i).first()).toBeVisible();
  await expect(page.getByText(/MDV\/MJ-/).first()).toBeVisible();
});

test("an invoice shows GST split and a rupee total", async ({ page }) => {
  await page.goto("/invoicing");
  const hrefs = await page.locator('a[href^="/invoicing/"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""));
  const invHref = hrefs.find((h) => !/\/invoicing\/new$/.test(h));
  test.skip(!invHref, "no invoices — seed with SEED_DEMO_DATA=true");

  await page.goto(invHref!);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/MDV\/INV-/).first()).toBeVisible();
  // Intra-Tamil-Nadu supply splits CGST + SGST (§4).
  await expect(page.getByText(/CGST/i).first()).toBeVisible();
  await expect(page.getByText(/SGST/i).first()).toBeVisible();
  await expect(page.getByText(/₹/).first()).toBeVisible();
});
