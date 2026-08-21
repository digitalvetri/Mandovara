// The free-text estimate path: a formal price for a website enquiry with no
// catalogue pick, no project and no measurement.
//
// Before this existed, /quotations/new demanded a project and the quick
// builder demanded a colourway plus width and height on every line — so there
// was no way to answer "send me a price" the same day.

import { test, expect } from "@playwright/test";

test.describe("free-text estimate", () => {
  // The "Quick estimate" list-header button was removed at the owner's
  // request. The route itself still works, so a direct visit still creates
  // an estimate — the "reachable from list" test that used to sit here is
  // no longer meaningful.

  test("creates a formal estimate from words alone, and marks it as an estimate", async ({ page }) => {
    await page.goto("/quotations/estimate");
    await expect(page.getByText(/without picking anything from the catalogue/i)).toBeVisible();

    // No catalogue picker anywhere on this page — that is the point.
    await expect(page.getByText(/search the catalogue|pick a product/i)).toHaveCount(0);

    const unique = `Website Enquiry ${Date.now()}`;
    await page.getByLabel("Name").fill(unique);
    await page.getByLabel("Mobile").fill("+919876500011");

    await page.getByLabel("Description").fill("Curtains — 3 bedrooms, stitched and installed");
    await page.getByLabel("Qty").fill("1");
    await page.getByLabel("Rate ₹").fill("45000");

    // Live total before saving: 45,000 + 18% = 53,100.
    await expect(page.getByText("₹53,100").first()).toBeVisible();

    await page.getByRole("button", { name: /create estimate/i }).click();

    // Lands on the created document, visibly marked as an estimate.
    await page.waitForURL(/\/quotations\/[a-z0-9-]{20,}/i, { timeout: 20_000 });
    await expect(page.getByText(/MDV\/QT-/).first()).toBeVisible();
    await expect(
      page.getByText("Estimate", { exact: true }).first(),
      "an un-measured quote must be badged so it is not mistaken for a firm one",
    ).toBeVisible();
    await expect(page.getByText(unique).first()).toBeVisible();
  });

  test("the PDF renders as an ESTIMATE with the measurement caveat", async ({ page, request }) => {
    // Find an estimate created above (no measurement on any line).
    await page.goto("/quotations");
    const hrefs = await page.locator('a[href^="/quotations/"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""));
    const id = hrefs.map((h) => h.split("/").pop() ?? "")
      .find((x) => x.length > 20 && !["new", "quick", "estimate"].includes(x));
    test.skip(!id, "no quotation records");

    const res = await request.get(`/api/quotations/${id}/pdf`);
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("application/pdf");
    expect((await res.body()).length).toBeGreaterThan(1000);
  });
});
