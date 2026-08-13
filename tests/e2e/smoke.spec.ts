import { expect, test } from "@playwright/test";

// Login page is force-static — no DB call, always renders in CI.
// Clear the dev_uid cookie first so the page doesn't redirect to the app.
test("login page renders brand mark and sign-in prompt", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  // "Welcome back" heading is always visible in the right-panel login card
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  // Login form has a "Sign In" submit button
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
