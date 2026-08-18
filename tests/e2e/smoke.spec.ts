import { expect, test } from "@playwright/test";

// Login page is force-dynamic — no DB call except session verify.
// Clear cookies first so the page doesn't redirect the pre-authenticated
// context back to the app.
test("login page renders brand mark and sign-in prompt", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/login");
  // "Welcome back" heading is always visible in the right-panel login card
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  // Login form has a Sign In button — always visible now that the PIN tab
  // was removed and the card is a single password form.
  await expect(page.getByLabel(/email or mobile/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
