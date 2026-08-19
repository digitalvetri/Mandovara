import { defineConfig, devices } from "@playwright/test";

const AUTH_FILE = "tests/e2e/.auth/owner.json";

// Port 3000 is a common collision (another project's container often holds it),
// and running the suite against the wrong app silently "passes". Override with
// E2E_PORT if 3399 is taken.
const PORT = process.env["E2E_PORT"] ?? "3399";
const BASE_URL = `http://localhost:${PORT}`;

// §3.2 — the suite must exercise the app as the RESTRICTED role, otherwise RLS
// is bypassed and the isolation the tests appear to prove is not being tested
// at all. Falls back to the owner connection only if the role was never created.
const APP_DATABASE_URL =
  process.env["APP_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // Auth setup runs first; only uses chromium, no storageState needed
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // All test projects depend on setup and inherit the saved session.
    // Both chromium/mobile-android EXCLUDE the RBAC matrix — it fires 270
    // rapid page loads and starves scenario tests in parallel. Run it in
    // its own project via `pnpm test:e2e --project=rbac-matrix`.
    {
      name: "chromium",
      testIgnore: /rbac-matrix\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
    {
      name: "mobile-android",
      testIgnore: /rbac-matrix\.spec\.ts/,
      use: { ...devices["Pixel 5"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
    // Dedicated project: chromium-only, single worker, no cross-spec
    // contention. Not part of the default `pnpm test:e2e` — invoke with
    // `pnpm test:e2e --project=rbac-matrix`.
    {
      name: "rbac-matrix",
      testMatch: /rbac-matrix\.spec\.ts/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // pnpm exec resolves the local `next` binary on both POSIX and Windows;
    // `./node_modules/.bin/next` breaks on Windows cmd/PowerShell.
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    // Never reuse: a stale server on this port may be a different build, or the
    // same build without APP_DATABASE_URL, which would quietly skip RLS.
    reuseExistingServer: false,
    timeout: 180_000,
    env: { ...process.env, APP_DATABASE_URL } as Record<string, string>,
  },
});
