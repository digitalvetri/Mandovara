// Discover real record ids by reading the list pages.
//
// These specs used to be gated on E2E_PROJECT_ID / E2E_MAKE_JOB_ID /
// E2E_INSTALL_VISIT_ID / E2E_LEAD_ID / E2E_CLIENT_ID. Nobody sets those, so
// 26 tests skipped on every run — including the whole make and install
// surface. Reading the id off the list page removes the coupling and, as a
// bonus, exercises list -> detail navigation for real.
//
// An env var still wins when supplied, so a CI job can pin a specific record.

import type { Page } from "@playwright/test";

// Route segments that live alongside :id and must never be mistaken for one.
const NOT_AN_ID = new Set(["new", "edit", "quick", "estimate", "requests", "vendors", "dispatch", "conflicts"]);

async function firstIdFrom(page: Page, listPath: string, hrefPrefix: string): Promise<string | null> {
  await page.goto(listPath);
  // Read all hrefs at once: locator.first().getAttribute() on an empty match
  // blocks until the whole test times out, which turned "no data" into a
  // 30-second failure instead of a clean skip.
  const hrefs = await page
    .locator(`a[href^="${hrefPrefix}/"]`)
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""));

  for (const href of hrefs) {
    const id = href.slice(hrefPrefix.length + 1).split(/[/?#]/)[0] ?? "";
    if (id.length > 0 && !NOT_AN_ID.has(id)) return id;
  }
  return null;
}

export async function projectId(page: Page): Promise<string | null> {
  return process.env["E2E_PROJECT_ID"] ?? firstIdFrom(page, "/projects", "/projects");
}
export async function leadId(page: Page): Promise<string | null> {
  // Pin to NEW leads so callers get one that is still convertible.
  // The default /leads list can surface a WON / LOST lead first, which
  // hides the "Convert to Client" button and breaks the conversion smoke.
  return process.env["E2E_LEAD_ID"] ?? firstIdFrom(page, "/leads?status=NEW", "/leads");
}
export async function clientId(page: Page): Promise<string | null> {
  return process.env["E2E_CLIENT_ID"] ?? firstIdFrom(page, "/clients", "/clients");
}
export async function makeJobId(page: Page): Promise<string | null> {
  return process.env["E2E_MAKE_JOB_ID"] ?? firstIdFrom(page, "/make", "/make");
}
export async function colourwayId(page: Page): Promise<string | null> {
  // ?hasLot=1 filters the inventory to colourways that have at least one
  // StockBalance row with a non-null dyeLot. The seed creates exactly these
  // entries in the dead-stock and mixed-lot-override edge-case fixtures.
  // Any colourway returned here will render the dye-lot pin on its PDP.
  return process.env["E2E_COLOURWAY_ID"] ?? firstIdFrom(page, "/inventory?hasLot=1", "/products");
}
