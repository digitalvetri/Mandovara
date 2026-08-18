// §12.2 Scenario 6 — "Log in as INSTALLER; verify cost price and margin appear
// nowhere in any network response."
//
// §3.1 and §15.8 require cost and margin to be stripped SERVER-SIDE, never
// merely hidden with CSS. The only way to prove that is to read the bytes on
// the wire, which is what this spec does: it walks the surfaces an installer
// can reach and scans every response body for cost/margin markers.
//
// There is a matching unit-level check (tests/kernel/catalog-cost-strip.test.ts)
// but that asserts the query layer in isolation; this asserts the actual HTTP
// payload, including anything a server component serialises into the RSC flight
// data — which is exactly where a leak would hide.

import { test, expect, type Page } from "@playwright/test";

// This spec ROTATES the account's password, so each Playwright project needs
// its own installer-role user. Sharing one made the two projects race: the
// loser could not log in and the test SKIPPED — a security assertion that
// quietly does not run is worse than one that fails.
const INSTALLER_BY_PROJECT: Record<string, string> = {
  chromium:         "vignesh@mandovara.com",   // INSTALLER
  "mobile-android": "senthil@mandovara.com",   // STORE — also lacks catalog.viewCost
};
const TEMP_PASSWORD = "Mandovara@2026";
const NEW_PASSWORD  = "InstallerSpec_2026!";

// Keys that must never reach a role without catalog.viewCost. Matched against
// serialised payloads, so we look for the JSON/flight key forms.
// Business fields only. An earlier draft matched /"margin"\s*:/ and flagged
// every inline CSS `margin:` in the RSC payload — a false positive that would
// have made this gate useless noise.
const FORBIDDEN = [
  /"cost"\s*:\s*(?!null)[^,}\]]/i,   // the stripped catalog field, non-null
  /"costPrice"\s*:/i,
  /"costPaise"\s*:/i,
  /"costValue"\s*:/i,
  /"marginPct"\s*:/i,
  /"marginPaise"\s*:/i,
  /"tier"\s*:\s*"COST"/i,             // a COST price row reaching the client
];

async function signIn(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto("/login");
  await page.getByLabel(/email or mobile/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

// Idempotent: the seeded temp password works on a fresh database, the rotated
// one works on a re-run.
async function loginAsInstaller(page: Page, email: string): Promise<boolean> {
  if (!(await signIn(page, email, TEMP_PASSWORD)) && !(await signIn(page, email, NEW_PASSWORD))) {
    return false;
  }
  if (page.url().includes("/change-password")) {
    await page.getByLabel(/current password/i).fill(TEMP_PASSWORD);
    await page.getByLabel(/^new password$/i).fill(NEW_PASSWORD);
    await page.getByLabel(/confirm new password/i).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: /change password/i }).click();
    await page.waitForTimeout(1500);
    // The rotation signs the user out — log back in with the new password.
    if (page.url().includes("/login")) {
      return signIn(page, email, NEW_PASSWORD);
    }
  }
  return true;
}

test("INSTALLER never receives cost price or margin over the network", async ({ page, context }, testInfo) => {
  await context.clearCookies();
  const email = INSTALLER_BY_PROJECT[testInfo.project.name] ?? "vignesh@mandovara.com";

  const offenders: { url: string; hit: string }[] = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] ?? "";
    if (!/text|json|javascript/.test(ct)) return;
    // Skip the framework's own JS bundles — they contain no tenant data and
    // legitimately reference field names in dev builds.
    if (/\/_next\/static\//.test(res.url())) return;
    let body = "";
    try { body = await res.text(); } catch { return; }
    for (const rx of FORBIDDEN) {
      if (rx.test(body)) offenders.push({ url: res.url(), hit: rx.source });
    }
  });

  const loggedIn = await loginAsInstaller(page, email);
  // Deliberately a hard failure, not a skip: this is a security assertion.
  expect(loggedIn, `could not sign in as ${email} — reseed with SEED_DEMO_DATA=true`).toBe(true);

  // Every surface an installer can reach, plus the catalog, which is where
  // cost lives and therefore where a leak is most likely.
  for (const route of ["/", "/products", "/install", "/projects", "/inventory"]) {
    await page.goto(route).catch(() => undefined);
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }

  expect(
    offenders,
    `Cost/margin leaked to an INSTALLER:\n${offenders.map((o) => `  ${o.hit} in ${o.url}`).join("\n")}`,
  ).toEqual([]);
});
