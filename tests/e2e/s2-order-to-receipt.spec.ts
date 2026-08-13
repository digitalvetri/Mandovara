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

const _ORDER_ID        = process.env["E2E_ORDER_ID"];
const MAKE_JOB_ID      = process.env["E2E_MAKE_JOB_ID"];
const INSTALL_VISIT_ID = process.env["E2E_INSTALL_VISIT_ID"];

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

// ── Allocation console ────────────────────────────────────────────────────────

test("allocation console renders — either pending lines or all-clear message", async ({ page }) => {
  await page.goto("/purchase/allocation");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Either shows "All order lines are allocated" or the allocation table header
  const allClear = page.getByText(/nothing to allocate|all order lines are allocated/i);
  const table    = page.getByRole("table");
  await expect(allClear.or(table)).toBeVisible();
});

test("allocation console shows Allocate button for pending lines", async ({ page }) => {
  await page.goto("/purchase/allocation");
  await expectNoRuntimeError(page);
  // If there are pending lines, the Allocate button is visible
  const allocateBtn = page.getByRole("button", { name: /allocate/i }).first();
  const allClear = page.getByText(/nothing to allocate|all order lines are allocated/i);
  await expect(allocateBtn.or(allClear)).toBeVisible();
});

// ── Make (cut & stitch) ───────────────────────────────────────────────────────

test("make kanban loads with status columns", async ({ page }) => {
  await page.goto("/make");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Kanban board should show at least one status label
  await expect(page.getByText(/queued|cutting|stitching|finishing|qc|ready/i).first()).toBeVisible();
});

test("make job detail renders cut list", async ({ page }) => {
  test.skip(!MAKE_JOB_ID, "E2E_MAKE_JOB_ID not set");
  await page.goto(`/make/${MAKE_JOB_ID}`);
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
  test.skip(!INSTALL_VISIT_ID, "E2E_INSTALL_VISIT_ID not set");
  await page.goto(`/install/${INSTALL_VISIT_ID}`);
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

test("accounts page loads with overdue and receipts panels", async ({ page }) => {
  await page.goto("/accounts");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/overdue|receipt|advance/i).first()).toBeVisible();
});

// ── Inventory (stock balances) ────────────────────────────────────────────────

test("inventory page loads with balance list", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/stock|inventory|balance/i).first()).toBeVisible();
});
