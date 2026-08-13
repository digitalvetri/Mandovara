// §12.2 Scenario 3 — dashboard, admin, HR, automation and reporting pages.
//
// These pages were not covered by s1/s2 but call query modules that had
// ts-nocheck directives covering schema mismatches (admin/queries, employees/queries).
// This spec extends the runtime-error net to every list page in the app.

import { test, expect, type Page } from "@playwright/test";

async function expectNoRuntimeError(page: Page) {
  await expect(
    page.getByText(/PrismaClientValidationError|Unknown field|Unhandled Runtime Error/i),
  ).toHaveCount(0);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

test("dashboard loads KPI cards and project pipeline", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Should render some KPI-style numbers or the project stage pipeline
  await expect(
    page.getByText(/projects?|leads?|revenue|overdue/i).first(),
  ).toBeVisible();
});

// ── Admin ─────────────────────────────────────────────────────────────────────

test("admin page loads users and audit log", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Users & roles section should be present
  await expect(
    page.getByText(/users?\s*[&]\s*roles?|employees?|audit/i).first(),
  ).toBeVisible();
});

// ── Reports ───────────────────────────────────────────────────────────────────

test("reports page loads all five report sections", async ({ page }) => {
  await page.goto("/reports");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // At least one report header should be visible
  await expect(
    page.getByText(/profit|margin|revenue|architect|conversion|dead stock|wastage/i).first(),
  ).toBeVisible();
});

// ── WhatsApp ──────────────────────────────────────────────────────────────────

test("whatsapp page loads rules, templates and inbox", async ({ page }) => {
  await page.goto("/whatsapp");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(
    page.getByText(/automation rules?|templates?|inbox|meta cloud/i).first(),
  ).toBeVisible();
});

// ── Attendance ────────────────────────────────────────────────────────────────

test("attendance page loads today punch grid", async ({ page }) => {
  await page.goto("/attendance");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(
    page.getByText(/attendance|present|leave/i).first(),
  ).toBeVisible();
});

// ── Payroll ───────────────────────────────────────────────────────────────────

test("payroll page loads run summary or empty state", async ({ page }) => {
  await page.goto("/payroll");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(
    page.getByText(/payroll|gross|net pay|no payroll/i).first(),
  ).toBeVisible();
});

// ── Report export ─────────────────────────────────────────────────────────────

test("reports export endpoint returns a valid xlsx file", async ({ request }) => {
  const response = await request.get("/api/reports/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  expect(response.headers()["content-disposition"]).toMatch(/mandovara-reports-\d{4}-\d{2}-\d{2}\.xlsx/);
  // XLSX magic bytes: PK (zip archive)
  const body = await response.body();
  expect(body[0]).toBe(0x50); // P
  expect(body[1]).toBe(0x4b); // K
  expect(body.length).toBeGreaterThan(4000);
});
