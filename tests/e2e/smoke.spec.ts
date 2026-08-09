// Baseline dashboard smoke — replaces the Session 1 placeholder
// that checked for a heading no longer in the codebase. The real
// coverage of §14 gate items lives in the topic specs (see
// docs/COVERAGE.md).

import { expect, test } from "@playwright/test";

test("owner dashboard loads with Operations Today section", async ({ page }) => {
  await page.goto("/");
  // Topbar title is a display-font h1 with text "Dashboard".
  await expect(page.getByRole("heading", { name: /^Dashboard$/ })).toBeVisible();
  // KPI row (Revenue MTD is the first card).
  await expect(page.getByText(/^Revenue \(MTD\)$/)).toBeVisible();
  // Operations Today section landed in Phase 8b.
  await expect(page.getByText(/^Operations Today$/)).toBeVisible();
});
