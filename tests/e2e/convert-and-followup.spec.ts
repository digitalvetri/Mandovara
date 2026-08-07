// Ad-hoc smoke tests for two UI additions:
//   - Convert button on lead detail
//   - Inline follow-up form on client detail
//
// IDs are read from env so the test runner doesn't have to reach into the DB.
//   E2E_LEAD_ID   — a lead that is neither LOST nor already converted
//   E2E_CLIENT_ID — any existing ACTIVE client

import { test, expect } from "@playwright/test";

const LEAD_ID = process.env["E2E_LEAD_ID"];
const CLIENT_ID = process.env["E2E_CLIENT_ID"];

test("lead → client conversion redirects to /clients/[id]", async ({ page }) => {
  test.skip(!LEAD_ID, "E2E_LEAD_ID not set");
  await page.goto(`/leads/${LEAD_ID}`);
  await expect(page.getByRole("button", { name: /convert to client/i })).toBeVisible();
  await page.getByRole("button", { name: /convert to client/i }).click();
  await page.waitForURL(/\/clients\/[a-z0-9]+/i);
});

test("follow-up can be added from client detail page", async ({ page }) => {
  test.skip(!CLIENT_ID, "E2E_CLIENT_ID not set");
  await page.goto(`/clients/${CLIENT_ID}`);
  await expect(page.getByText(/New follow-up/i)).toBeVisible();
  await page.getByPlaceholder(/What to talk about/i).fill("Smoke: inline followup");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText(/Follow-up scheduled/i)).toBeVisible();
});
