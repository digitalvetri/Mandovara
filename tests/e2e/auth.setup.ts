// Auth setup — runs once before all test suites.
// Performs a real login via the /login form so the signed session cookie
// is issued by the server. This is more robust than crafting a cookie by
// hand (which would break every time SESSION_SECRET rotates).

import { test as setup, expect } from "@playwright/test";
import path from "path";

export const OWNER_AUTH_FILE = path.join(__dirname, ".auth", "owner.json");

// Matches the seed's DEFAULT_DEV_PASSWORD in prisma/seed/masters.ts.
const OWNER_EMAIL = "rohit@mandovara.com";
const OWNER_PASSWORD = "Mandovara@2026";

setup("authenticate as owner", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel(/email or mobile/i).fill(OWNER_EMAIL);
  await page.getByLabel(/^password$/i).fill(OWNER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for the redirect off /login (either dashboard or wherever ?from= sent us).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/login/);
  await context.storageState({ path: OWNER_AUTH_FILE });
});
