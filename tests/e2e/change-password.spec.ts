// Verifies the full force-change-password flow end-to-end. Run against a DB
// where rohit@mandovara.com has mustChangePassword=true.
//
// Flow: login with temp → forced to /change-password → submit new →
// signed out → login with old fails → login with new succeeds and lands on /.

import { test, expect } from "@playwright/test";

const EMAIL = "rohit@mandovara.com";
const OLD_PWD = "Mandovara@2026";
const NEW_PWD = "OneTimeSpec_2026!";

test("force-change password flow", async ({ page, context }) => {
  // The test projects inherit an already-authenticated storageState — clear
  // cookies so /login actually renders the form instead of redirecting.
  await context.clearCookies();

  // 1. Login with temp password
  await page.goto("/login");
  await page.getByLabel(/email or mobile/i).fill(EMAIL);
  await page.getByLabel(/^password$/i).fill(OLD_PWD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // 2. Land on /change-password (forced)
  await page.waitForURL(/\/change-password/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /set a new password/i })).toBeVisible();

  // 3. Submit new password
  await page.getByLabel(/current password/i).fill(OLD_PWD);
  await page.getByLabel(/^new password$/i).fill(NEW_PWD);
  await page.getByLabel(/confirm new password/i).fill(NEW_PWD);
  await page.getByRole("button", { name: /change password/i }).click();

  // 4. Signed out, back at /login
  await page.waitForURL(/\/login/, { timeout: 10_000 });

  // 5. Old password no longer works
  await page.getByLabel(/email or mobile/i).fill(EMAIL);
  await page.getByLabel(/^password$/i).fill(OLD_PWD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email\/mobile or password/i)).toBeVisible({ timeout: 5_000 });

  // 6. New password works and lands off /login (not on /change-password — flag cleared)
  await page.getByLabel(/^password$/i).fill(NEW_PWD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login") && !url.pathname.startsWith("/change-password"), { timeout: 10_000 });

  // Clean up: restore the seeded password + flag so other tests keep working.
  await page.goto("/change-password");
  await page.getByLabel(/current password/i).fill(NEW_PWD);
  await page.getByLabel(/^new password$/i).fill(OLD_PWD);
  await page.getByLabel(/confirm new password/i).fill(OLD_PWD);
  await page.getByRole("button", { name: /change password/i }).click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });
});
