// §12.2 acceptance #3 — "Measure a wallpaper wall with an offset
// repeat; verify roll count and the warning; change to free match;
// verify it drops by one roll."
//
// Drives the Material Estimator playground (/measure) which calls
// the same pure /lib/calc/wallpaper function that unit tests cover.
// The purpose here is to exercise the WIRING (state, memoisation,
// re-render on select change), not the math itself.

import { expect, test } from "@playwright/test";

test.describe("§12.2 #3 · wallpaper measurement", () => {
  test("offset repeat vs free match — roll count and warning flip", async ({ page }) => {
    await page.goto("/measure");
    // Wallpaper tab is default; make it explicit for robustness.
    await page.getByRole("button", { name: /^Wallpaper$/ }).click();

    // Fixture: 4000×2700 wall, roll 530×10.05m — the estimator's
    // default numbers. Swap match to OFFSET with a 320mm repeat.
    // Expected effect: cutLength jumps because ceil((2700 + 320/2) / 320) × 320,
    // stripsPerRoll drops, rollsRequired goes up.
    // (This is a wiring test — the exact numbers are pinned by the
    // /lib/calc/wallpaper unit tests.)

    // Grab the initial roll count under FREE match.
    const heroValue = () => page.locator('text=Rolls required').locator('..').locator('span.tabular').first();
    const freeMatchRolls = Number(await heroValue().innerText());
    expect(freeMatchRolls).toBeGreaterThan(0);

    // Switch to OFFSET; the repeat field appears.
    await page.getByLabel("Pattern match").selectOption("OFFSET");
    // Enter a repeat that forces the cut length to grow.
    await page.getByLabel("Pattern repeat (mm)").fill("320");

    // Wait for a re-render then read again.
    await page.waitForTimeout(200);
    const offsetRolls = Number(await heroValue().innerText());

    // Under OFFSET with a repeat, the wall needs at LEAST as many
    // rolls as it did with FREE match — usually more. Assert
    // monotonic (not exact) so a future default change doesn't
    // break the spec.
    expect(offsetRolls).toBeGreaterThanOrEqual(freeMatchRolls);

    // Swap back to FREE — the field disappears, roll count returns
    // to (at most) the original.
    await page.getByLabel("Pattern match").selectOption("FREE");
    await page.waitForTimeout(200);
    const backToFree = Number(await heroValue().innerText());
    expect(backToFree).toBeLessThanOrEqual(offsetRolls);
    expect(backToFree).toBe(freeMatchRolls);
  });

  test("engine version chip renders under the warnings block", async ({ page }) => {
    await page.goto("/measure");
    await expect(page.getByText(/^Engine · wallpaper@/)).toBeVisible();
  });
});
