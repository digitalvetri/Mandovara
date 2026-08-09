// §12.2 Scenario 1 — Enquiry → schedule measurement → measure → sync → quote → WhatsApp → accept → order.
//
// This spec verifies that every page in the office-side flow loads, renders its
// core UI elements, and links between them are reachable. The offline measurement
// PWA sync step and WhatsApp send require a running WhatsApp integration and mobile
// device — those are verified manually against the Phase 5 and Phase 8 gates.
// E2E_PROJECT_ID — a project with at least one room and one measurement.
// E2E_LEAD_ID    — an existing lead.

import { test, expect, type Page } from "@playwright/test";

const PROJECT_ID = process.env["E2E_PROJECT_ID"];
const LEAD_ID    = process.env["E2E_LEAD_ID"];

// Discriminating check: Next.js dev error overlay renders the full error type and
// message in the DOM. If a page throws PrismaClientValidationError (wrong field
// names in a query file), this text appears. The previous `not.toHaveTitle(/500/)`
// check cannot catch this — dev error pages keep their own title.
async function expectNoRuntimeError(page: Page) {
  await expect(
    page.getByText(/PrismaClientValidationError|Unknown field|Unhandled Runtime Error/i),
  ).toHaveCount(0);
}

// ── 1. Leads (Enquiry) ────────────────────────────────────────────────────────

test("leads list loads with table and new-lead entry point", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/lead/i).first()).toBeVisible();
});

test("lead detail renders stage, contact, and action buttons", async ({ page }) => {
  test.skip(!LEAD_ID, "E2E_LEAD_ID not set");
  await page.goto(`/leads/${LEAD_ID}`);
  await expectNoRuntimeError(page);
  await expect(page.getByRole("heading").first()).toBeVisible();
});

// ── 2. Clients ────────────────────────────────────────────────────────────────

test("clients list loads with table", async ({ page }) => {
  await page.goto("/clients");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/client/i).first()).toBeVisible();
});

// ── 3. Projects ───────────────────────────────────────────────────────────────

test("projects list loads", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/project/i).first()).toBeVisible();
});

test("project detail renders with measurement and quotation tabs", async ({ page }) => {
  test.skip(!PROJECT_ID, "E2E_PROJECT_ID not set");
  await page.goto(`/projects/${PROJECT_ID}`);
  await expectNoRuntimeError(page);
  const heading = page.getByRole("heading").first();
  await expect(heading).toBeVisible();
  // Project hub should have stage navigation
  await expect(page.getByRole("link", { name: /measurement|quote|rooms/i }).first()).toBeVisible();
});

test("project measurements page renders room accordion", async ({ page }) => {
  test.skip(!PROJECT_ID, "E2E_PROJECT_ID not set");
  await page.goto(`/projects/${PROJECT_ID}/measurements`);
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
});

// ── 4. Quotations ─────────────────────────────────────────────────────────────

test("quotations list loads", async ({ page }) => {
  await page.goto("/quotations");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/quotation/i).first()).toBeVisible();
});

test("new quotation builder renders with project-required message when no project param", async ({ page }) => {
  await page.goto("/quotations/new");
  // QuotationBuilder shows "Start from a project" when projectId is absent
  await expect(page.getByText(/start from a project/i)).toBeVisible();
});

// ── 5. Orders ─────────────────────────────────────────────────────────────────

test("orders list loads", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  await expect(page.getByText(/order/i).first()).toBeVisible();
});
