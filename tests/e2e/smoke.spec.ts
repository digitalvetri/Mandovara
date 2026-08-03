import { expect, test } from "@playwright/test";

test("placeholder route renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Session 1 scaffold/i })).toBeVisible();
});
