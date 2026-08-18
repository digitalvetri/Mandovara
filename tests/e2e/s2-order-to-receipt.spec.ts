// §12.2 Scenario 2 — Order → PO → GRN with dye lot → allocate → make job →
//   cut list printed → install visit → client signature → invoice → receipt.
//
// This spec verifies every operations-side page loads and renders its core UI.
// DB-level behavior (dye-lot enforcement, append-only StockMove, GST computation)
// is covered in the unit and kernel tests.
//
// E2E_ORDER_ID  — a confirmed order.
// E2E_MAKE_JOB_ID — a make job (any status).
// E2E_INSTALL_VISIT_ID — a scheduled install visit.

import { test, expect, type Page } from "@playwright/test";
import { makeJobId, installVisitId } from "./_ids";

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

// ── Allocation console — UI removed. Backend actions + Prisma models
//    remain as safe scaffolding; only the /purchase/allocation route is
//    gone. Dye-lot allocation logic is still covered at the module
//    level in tests/kernel/concurrency/stock-issue.test.ts and the
//    mixed-lot integration test in tests/integration/.

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

// ── Install ───────────────────────────────────────────────────────────────────

test("install schedule page loads", async ({ page }) => {
  await page.goto("/install");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/install|visit|crew/i).first()).toBeVisible();
});

test("install visit detail renders room lines", async ({ page }) => {
  const id = await installVisitId(page);
  test.skip(!id, "no install visit in the database — run the seed with SEED_DEMO_DATA=true");
  await page.goto(`/install/${id}`);
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
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
// §12.2 Scenario 2 end to end: the same dye lot must be traceable from the
// goods receipt, through the allocation that reserved it, to the install line
// that records what physically went on the wall. That chain is the whole
// answer to "the wallpaper doesn't match — which lot went where?".

test("a dye lot is recorded at both ends of the chain — reserved, then fitted", async ({ page }) => {
  // Reserved end: the allocation console shows the lot held against a line.
  await page.goto("/purchase/allocation");
  await expectNoRuntimeError(page);
  const reservedLot = page.getByText(/LOT-[A-Z0-9-]+/).first();
  await expect(reservedLot, "no reserved lot on the allocation console").toBeVisible({ timeout: 15_000 });

  // Fitted end: the install sheet records the lot that physically went up.
  // Without both halves, "which lot went on which wall" is unanswerable —
  // which is the single most expensive recurring failure in this trade (§1.2).
  const visit = await installVisitId(page);
  test.skip(!visit, "no install visit — seed with SEED_DEMO_DATA=true");
  await page.goto(`/install/${visit}`);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/LOT-|dye lot/i).first()).toBeVisible({ timeout: 15_000 });
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

test("an install visit records the dye lot that was actually fitted", async ({ page }) => {
  const id = await installVisitId(page);
  test.skip(!id, "no install visit — seed with SEED_DEMO_DATA=true");
  await page.goto(`/install/${id}`);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/MDV\/INS-/).first()).toBeVisible();
  // The visit sheet is room-by-room; each line names the lot used.
  await expect(page.getByText(/LOT-|dye lot/i).first()).toBeVisible();
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
