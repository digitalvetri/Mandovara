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
// Only the `.lift` (transform) mechanism is tested here. Tailwind's
// `hover:-translate-y-*` also writes to `transform`, but it was never at risk
// from the fill-mode issue — the entrance animation only clobbers handlers
// sharing the exact same CSS property, and `-translate-y-*` composes via
// CSS custom properties that sit outside the animation keyframe. A second
// hover test for that mechanism was attempted but proved consistently flaky
// in headless Chromium (CSS :hover triggering via mouse events is unreliable
// without a real display). The `.lift` guard is what matters.
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
});
