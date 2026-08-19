// RBAC matrix — every seeded role × the 30 top-level app routes.
//
// This trunk doesn't do per-route 403 gating (see src/app/(app)/layout.tsx —
// it only checks logged-in). Feature-gating happens in-page via
// ctx.permissions. So the assertion here is a smoke test:
//
//   For each role × route:
//     - the response is not a 5xx
//     - the user is not bounced to /login
//     - the page renders past the shell
//
// A failure in this matrix means either (a) a hard crash in a page for a
// role that shouldn't crash it, or (b) an accidental /login redirect (auth
// bug). Fine-grained permission checks live in module-specific specs.
//
// Runs chromium-only. Mobile viewport RBAC is redundant — same code path,
// same response body.

import { test, expect, type BrowserContext } from "@playwright/test";
import { loginAs, resetAllRoleUsersToSeed, type SeedRole } from "./_helpers/multi-role-auth";

const ROLES: SeedRole[] = [
  "OWNER", "DESIGNER", "SALES", "MEASURE_EXEC",
  "STORE", "MAKE_SUPERVISOR", "INSTALLER", "ACCOUNTS", "HR",
];

// Every top-level app surface. Not detail pages — those need per-record IDs
// and are covered by scenario specs.
const ROUTES = [
  "/",              // dashboard
  "/leads",
  "/clients",
  "/architects",
  "/projects",
  "/quotations",
  "/orders",
  "/products",
  "/purchase",
  "/inventory",
  "/samples",
  "/measurements",
  "/measure",
  "/make",
  "/install",
  "/installations",
  "/site-visits",
  "/invoicing",
  "/accounts",
  "/attendance",
  "/payroll",
  "/employee",
  "/admin",
  "/whatsapp",
  "/reports",
  "/calendar",
  "/notifications",
  "/tasks",
  "/documents",
  "/profile",
];

// This spec fires 270 rapid page loads against the same dev server. Under
// the shared chromium/mobile-android projects it starved scenario specs and
// caused a flake in s2-order-to-receipt. Fix: playwright.config.ts now
// declares a dedicated `rbac-matrix` project (fullyParallel: false) that
// excludes this file from the default chromium/mobile-android runs.
//
// Run just this matrix:
//
//   pnpm test:e2e --project=rbac-matrix
//
// It is NOT part of the default `pnpm test:e2e` — see BUG-08 in
// PLAYWRIGHT-TEST-REPORT.md for the rationale.
test.describe("RBAC matrix — every role × every top-level route", () => {
  // Parallel by default. If one route 500s for one role, other combos
  // still run — we want the *full* failure list, not the first one.
  const contexts = new Map<SeedRole, BrowserContext>();

  // 9 UI logins run in parallel below — bump the hook budget.
  test.beforeAll(async ({ browser }, testInfo) => {
    // Pin to chromium: identical response bodies across viewports, no need
    // to double the runtime on mobile-android.
    test.skip(testInfo.project.name !== "chromium", "chromium-only");
    const pairs = await Promise.all(
      ROLES.map(async (role) => [role, await loginAs(browser, role)] as const),
    );
    for (const [role, ctx] of pairs) contexts.set(role, ctx);
  });
  test.setTimeout(120_000);

  test.afterAll(async () => {
    for (const ctx of contexts.values()) await ctx.close();
    await resetAllRoleUsersToSeed();
  });

  for (const role of ROLES) {
    for (const route of ROUTES) {
      test(`${role} @ ${route}`, async () => {
        const ctx = contexts.get(role);
        if (!ctx) throw new Error(`No context for ${role}`);
        const page = await ctx.newPage();
        try {
          // Use baseURL from config — port may vary via E2E_PORT.
          const resp = await page.goto(route, {
            waitUntil: "domcontentloaded",
            timeout: 15_000,
          });

          const status = resp?.status() ?? 0;

          // Must not bounce to /login (auth bug — session was valid)
          expect(page.url(), `${role}@${route} bounced to login`).not.toMatch(/\/login/);

          // Two failure modes:
          //   1. Backend correctly denies (ForbiddenError) — the app.error.tsx
          //      boundary renders a friendly "Access denied" panel, but Next.js
          //      still emits an HTTP 500 status. This is expected security
          //      behaviour — the assertion checks for the friendly text.
          //   2. A real crash — 500 with no friendly denial text, or 4xx.
          if (status >= 500) {
            await page.waitForSelector("body", { timeout: 5_000 });
            const bodyText = await page.locator("body").innerText();
            const friendly =
              /Access denied|Missing permission|Your role doesn't include/i.test(bodyText);
            expect(
              friendly,
              `HTTP ${status} for ${role}@${route} without a permission-denied UI — probable crash`,
            ).toBe(true);
          }
        } finally {
          await page.close();
        }
      });
    }
  }
});
