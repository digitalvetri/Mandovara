import { expect, test } from "@playwright/test";

// Login page is force-static — no DB call, always renders in CI.
test("login page renders brand mark and sign-in prompt", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("MANDOVARA").first()).toBeVisible();
  await expect(page.getByText("Sign in", { exact: true })).toBeVisible();
});
