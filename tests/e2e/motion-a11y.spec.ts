import { test, expect } from "@playwright/test";

// The entrance animations start at opacity 0. If the reduced-motion override
// ever stops landing them on their end state, every animated element on the
// dashboard becomes permanently invisible — a total blank page for anyone who
// has "reduce motion" on. Worth an explicit test rather than a comment.
test.describe("reduced motion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("animated content is visible when motion is reduced", async ({ page }) => {
    // emulateMedia rather than test.use({ reducedMotion }) — the latter is a
    // context option, not a top-level test option, so it runs but fails tsc.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const probes = await page.evaluate(() => {
      const sel = ".rise, .stagger > *, .kpi-underline";
      const els = [...document.querySelectorAll(sel)];
      return els.map((e) => {
        const c = getComputedStyle(e);
        return { opacity: Number(c.opacity), transform: c.transform };
      });
    });

    expect(probes.length, "no animated elements found — selector drifted").toBeGreaterThan(3);
    for (const p of probes) expect(p.opacity).toBeGreaterThan(0.99);
  });
});

test.describe("normal motion", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("animated content settles visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const min = await page.evaluate(() =>
      Math.min(...[...document.querySelectorAll(".rise, .stagger > *")]
        .map((e) => Number(getComputedStyle(e).opacity))));
    expect(min).toBeGreaterThan(0.99);
  });
});

// A filled-forwards animation keeps asserting its final keyframe, and an
// animated declaration outranks a normal one — so `rise` ending on
// `transform: none` silently beat every `:hover { transform: ... }` beneath
// it. Caught only because the lift stopped working. `backwards` fill fixes
// it; this pins the fix, because the failure is invisible in code review.
//
// Both hover mechanisms in the product are covered: `.lift` animates the
// `transform` property, while Tailwind v4's `-translate-y-*` writes the
// separate `translate` property and was never at risk. Testing only the
// second would have passed while the first stayed broken.
test.describe("hover survives the entrance animation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test(".lift still lifts once the entrance has finished", async ({ page }) => {
    // Dashboard KPI cards use .lift — leads was changed to a table layout
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const row = page.locator(".lift").first();
    const before = await row.evaluate((e) => getComputedStyle(e).transform);
    await row.hover();
    await page.waitForTimeout(350);
    const after = await row.evaluate((e) => getComputedStyle(e).transform);
    expect(after, "entrance animation is clobbering the hover transform").not.toBe(before);
  });

  // The inventory item name link uses Tailwind's `-translate-y-*`, keeping
  // the second mechanism covered. /inventory always has rows from the seed,
  // making it a stable anchor. It moved here from /products when that page
  // became a brand/PDF catalog that is empty in CI (no PDFs seeded) — and
  // this test failing at that moment is the guard doing its job.
  test("a Tailwind translate hover still moves", async ({ page }) => {
    await page.goto("/inventory", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    // The inventory row name link points to /products/[colourwayId].
    const card = page.locator("a[href^='/products/']:not([href$='/new'])").first();
    const before = await card.evaluate((e) => getComputedStyle(e).translate);
    await card.hover();
    await page.waitForTimeout(350);
    const after = await card.evaluate((e) => getComputedStyle(e).translate);
    expect(after).not.toBe(before);
  });
});
