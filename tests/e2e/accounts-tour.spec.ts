// Smoke of the /accounts first-run tour. Uses ?tour=1 so we don't
// depend on localStorage state from previous test runs.

import { test, expect } from "@playwright/test";

test("first-run tour walks through all 5 steps and closes", async ({ page }) => {
  await page.goto("/accounts?tour=1");

  // Step 1 visible
  await expect(page.getByRole("heading", { name: /this page answers five questions/i })).toBeVisible();
  await expect(page.getByText(/quick tour · 1 of 5/i)).toBeVisible();

  // Walk forward
  for (const stepNum of [2, 3, 4, 5]) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(new RegExp(`quick tour · ${stepNum} of 5`, "i"))).toBeVisible();
  }

  // Final step button says "Got it"
  await expect(page.getByRole("button", { name: /got it/i })).toBeVisible();
  await page.getByRole("button", { name: /got it/i }).click();

  // Tour is gone, KPI heading is visible
  await expect(page.getByRole("heading", { name: /this page answers five questions/i })).not.toBeVisible();
});

test("skip button dismisses the tour", async ({ page }) => {
  await page.goto("/accounts?tour=1");
  await expect(page.getByRole("heading", { name: /this page answers five questions/i })).toBeVisible();
  await page.getByRole("button", { name: /skip tour/i }).click();
  await expect(page.getByRole("heading", { name: /this page answers five questions/i })).not.toBeVisible();
});
