// Auth setup — runs once before all test suites.
//
// Performs a real login via the /login form so the signed session cookie
// is issued by the server. This is more robust than crafting a cookie by
// hand (which would break every time SESSION_SECRET rotates).
//
// Handles the force-change-password flow: seeded users land with
// mustChangePassword=true, so first login redirects to /change-password.
// We complete that step here so downstream (app) tests can navigate freely
// without bouncing back to the change-password gate.
//
// A separate spec (change-password.spec.ts) exercises the forced flow
// against a different user (aishwarya) so its verification isn't blown
// away by this setup rotation on rohit.

import { test as setup, expect } from "@playwright/test";
import path from "path";

export const OWNER_AUTH_FILE = path.join(__dirname, ".auth", "owner.json");

// Matches the seed's DEFAULT_DEV_PASSWORD in prisma/seed/masters.ts.
const OWNER_EMAIL   = "rohit@mandovara.com";
const OWNER_TEMP    = "Mandovara@2026";
// Canonical post-setup password. Used only within this test suite; must
// meet the changePassword min-length policy (10 chars).
const OWNER_STABLE  = "PlaywrightRun_2026!";

setup("authenticate as owner", async ({ page, context }) => {
  await page.goto("/login");
  // The login card defaults to the Mobile & PIN tab; owner login uses
  // the Password tab, so switch to it first. exact:true avoids matching
  // the "Show password" eye toggle.
  await page.getByRole("button", { name: "Password", exact: true }).click();
  await page.getByLabel(/email or mobile/i).fill(OWNER_EMAIL);
  await page.getByLabel(/^password$/i).fill(OWNER_TEMP);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  // If the seed marked this user with mustChangePassword=true, we're on
  // /change-password?forced=1. Complete the rotation so the saved state
  // grants access to (app) routes.
  if (page.url().includes("/change-password")) {
    await page.getByLabel(/current password/i).fill(OWNER_TEMP);
    await page.getByLabel(/^new password$/i).fill(OWNER_STABLE);
    await page.getByLabel(/confirm new password/i).fill(OWNER_STABLE);
    await page.getByRole("button", { name: /change password/i }).click();
    // The action signs the user out — back to /login.
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // Log back in with the new password.
    await page.getByRole("button", { name: "Password", exact: true }).click();
    await page.getByLabel(/email or mobile/i).fill(OWNER_EMAIL);
    await page.getByLabel(/^password$/i).fill(OWNER_STABLE);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) =>
      !url.pathname.startsWith("/login") &&
      !url.pathname.startsWith("/change-password"),
      { timeout: 15_000 },
    );
  }

  await expect(page).not.toHaveURL(/\/(login|change-password)/);
  await context.storageState({ path: OWNER_AUTH_FILE });
});
