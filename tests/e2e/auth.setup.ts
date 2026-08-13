// Auth setup — runs once before all test suites.
// Sets the dev_uid cookie directly so the (app)/layout.tsx gate passes.
// devContext() handles fallback to the first OWNER user in the DB.

import { test as setup } from "@playwright/test";
import path from "path";

export const OWNER_AUTH_FILE = path.join(__dirname, ".auth", "owner.json");

setup("authenticate as owner", async ({ context }) => {
  // Set dev_uid to any non-empty string — layout.tsx only checks .has("dev_uid").
  // devContext() will fall back to the first OWNER user in the DB automatically.
  await context.addCookies([
    {
      name: "dev_uid",
      value: "playwright-dev-owner",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  await context.storageState({ path: OWNER_AUTH_FILE });
});
