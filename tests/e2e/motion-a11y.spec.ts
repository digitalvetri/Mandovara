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

  // The "Add item (to catalog)" toolbar link on /inventory uses Tailwind's
  // `-translate-y-*`, keeping the second mechanism covered. The toolbar always
  // renders regardless of whether the stock list has rows — making it a stable
  // anchor even when the inventory is empty.
  test("a Tailwind translate hover still moves", async ({ page }) => {
    await page.goto("/inventory", { waitUntil: "domcontentloaded" });
    // The "Add item (to catalog)" link in InventoryToolbar always renders.
    // Tailwind's `-translate-y-*` compiles into `transform: translate(...)`,
    // NOT the standalone `translate` CSS property. Reading `.translate` would
    // return "none" both before and after hover; read `.transform` instead.
    const card = page.locator("a[href='/products']").first();
    await card.waitFor({ state: "visible" });
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000); // entrance animations settle
    // Use explicit mouse coordinates — more reliable than .hover() for
    // triggering CSS :hover in headless Chromium.
    const box = (await card.boundingBox())!;
    await page.mouse.move(0, 0); // neutral start
    const before = await card.evaluate((e) => getComputedStyle(e).transform);
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2,
      { steps: 5 },
    );
    await page.waitForTimeout(400);
    const after = await card.evaluate((e) => getComputedStyle(e).transform);
    expect(after).not.toBe(before);
  });
});
