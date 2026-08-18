// Ad-hoc smoke tests for two UI additions:
//   - Convert button on lead detail
//   - Inline follow-up form on client detail
//
// IDs are read from env so the test runner doesn't have to reach into the DB.
//   E2E_LEAD_ID   — a lead that is neither LOST nor already converted
//   E2E_CLIENT_ID — any existing ACTIVE client

import { test, expect } from "@playwright/test";
import { leadId, clientId } from "./_ids";


test("lead → client conversion redirects to /clients/[id]", async ({ page }) => {
  const LEAD_ID = await leadId(page);
  test.skip(!LEAD_ID, "no lead in the database — run the seed with SEED_DEMO_DATA=true");
  await page.goto(`/leads/${LEAD_ID}`);
  await expect(page.getByRole("button", { name: /convert to client/i })).toBeVisible();
  await page.getByRole("button", { name: /convert to client/i }).click();

  // The button opens a confirmation modal that collects billing details; it
  // does not navigate on its own. The test used to click and immediately wait
  // for /clients/[id], so it always timed out.
  await expect(page.getByRole("heading", { name: "Convert to Client" })).toBeVisible();
  await page.getByRole("button", { name: /convert & create project/i }).click();

  // Conversion lands on the new project (or the client when no project is made).
  await page.waitForURL(/\/(clients|projects)\/[a-z0-9-]+/i, { timeout: 20_000 });
});

test("follow-up can be added from client detail page", async ({ page }) => {
  const CLIENT_ID = await clientId(page);
  test.skip(!CLIENT_ID, "no client in the database — run the seed with SEED_DEMO_DATA=true");
  await page.goto(`/clients/${CLIENT_ID}`);
  await expect(page.getByText(/New follow-up/i)).toBeVisible();
  await page.getByPlaceholder(/What to talk about/i).fill("Smoke: inline followup");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText(/Follow-up scheduled/i)).toBeVisible();
});
