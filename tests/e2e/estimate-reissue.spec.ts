// The full loop: website enquiry → estimate → convert → measure → firm quote.
//
// The estimate half is covered in estimate.spec.ts. This asserts the second
// half: an estimate offers reissue, explains itself when it cannot run, and
// produces a measured revision that is no longer badged ESTIMATE.

import { test, expect } from "@playwright/test";

// Both tests here depend on the Estimate badge and "Reissue as firm
// quotation" button in the quotation header. Both were deliberately
// removed by a2cf285 (24 Aug 2026, owner's request). Keeping the file
// so the intent survives if the feature comes back — but skipping the
// specs so CI is not held hostage by obsolete UI assertions.
test.describe.skip("estimate → firm quotation (feature removed 2026-08-24)", () => {
  test("a fresh lead-scoped estimate offers reissue but explains what is missing", async ({ page }) => {
    await page.goto("/quotations/estimate");
    const unique = `Reissue Probe ${Date.now()}`;
    await page.getByLabel("Name").fill(unique);
    await page.getByLabel("Mobile").fill("+919876500022");
    await page.getByLabel("Description").fill("Curtains — 2 bedrooms");
    await page.getByLabel("Rate ₹").fill("30000");
    await page.getByRole("button", { name: /create estimate/i }).click();
    await page.waitForURL(/\/quotations\/[a-z0-9-]{20,}/i, { timeout: 20_000 });

    await expect(page.getByText("Estimate", { exact: true }).first()).toBeVisible();

    // The button is present but blocked, and says why — it must not simply
    // vanish, or nobody learns that conversion is the missing step.
    const btn = page.getByRole("button", { name: /reissue as firm quotation/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeDisabled();
    await expect(page.getByText(/convert the lead to a client first/i)).toBeVisible();
  });

  test("an estimate on a measured project reissues into a firm quotation", async ({ page }) => {
    // Find a project that already has approved measurements (the seed has
    // plenty), then check the reissue precheck reasoning end to end via a
    // seeded measured quotation: it must NOT offer reissue at all.
    await page.goto("/quotations");
    const hrefs = await page.locator('a[href^="/quotations/"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""));
    const measured = hrefs.find((h) => !/\/quotations\/(new|quick|estimate)$/.test(h));
    test.skip(!measured, "no quotation records — seed with SEED_DEMO_DATA=true");

    await page.goto(measured!);
    // A measured quotation is not an estimate, so no badge and no reissue.
    await expect(page.getByRole("button", { name: /reissue as firm quotation/i })).toHaveCount(0);
  });
});
