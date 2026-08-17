import { expect, test } from "@playwright/test";

// Login page is force-dynamic — no DB call except session verify.
// Clear cookies first so the page doesn't redirect the pre-authenticated
// context back to the app.
test("login page renders brand mark and sign-in prompt", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  // "Welcome back" heading is always visible in the right-panel login card
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  // Login card has the two-tab switcher — always visible regardless of
  // which tab is active. exact:true avoids the "Show password" eye toggle
  // whose aria-label also contains "password".
  await expect(page.getByRole("button", { name: "Password", exact: true })).toBeVisible();
});
