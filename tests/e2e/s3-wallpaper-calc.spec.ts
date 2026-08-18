// §12.2 Scenario 3 — "Measure a wallpaper wall with an offset repeat; verify
// the roll count and the warning; change to free match; verify it drops by
// one roll."
//
// This drives the real on-site estimator at /measure, which is the surface a
// designer uses in a client's living room. It is the end-to-end proof of the
// calc-engine consolidation: that panel used to call a SECOND, divergent
// wallpaper implementation under src/lib/calc which returned 4 rolls where the
// engine that priced the quotation returned 3. Both now come from
// src/kernel/calc, so what the salesperson reads is what the quote charges.
//
// Canonical §7.2 case: 4000×2700 wall, 530mm × 10.05m roll, 640mm repeat.
//   OFFSET → cut 3520mm, 2 strips/roll, 4 rolls, "adds 1 roll" warning
//   FREE   → cut 2700mm, 3 strips/roll, 3 rolls

import { test, expect, type Page } from "@playwright/test";

async function setNum(page: Page, label: string, value: string) {
  const field = page.locator("label", { hasText: label }).locator('input[type="number"]');
  await field.first().fill(value);
  await field.first().blur();
}

async function rollsRequired(page: Page): Promise<string> {
  const hero = page.locator("div", { hasText: /^Rolls required$/ }).first();
  // The numeral is the sibling display inside the same HeroNumber block.
  return (await hero.locator("xpath=following-sibling::div[1]//span[1]").innerText()).trim();
}

test.describe("§12.2/3 — wallpaper offset vs free match", () => {
  test("offset repeat costs a roll, and dropping to free match gives it back", async ({ page }) => {
    await page.goto("/measure");

    // The estimator opens on the wallpaper panel; make sure it is there.
    await expect(page.getByText("Wall width (mm)")).toBeVisible({ timeout: 15_000 });

    await setNum(page, "Wall width (mm)", "4000");
    await setNum(page, "Wall height (mm)", "2700");
    await setNum(page, "Roll width (mm)", "530");
    await setNum(page, "Roll length (m)", "10.05");
    // §7.2's worked examples are stated with no wastage.
    await setNum(page, "Wastage (%)", "0");

    // ── Offset (half-drop) ────────────────────────────────────────────────
    await page.locator("label", { hasText: "Pattern match" }).locator("select").selectOption("OFFSET");
    await setNum(page, "Pattern repeat (mm)", "640");
    await page.waitForTimeout(300);

    const offsetRolls = await rollsRequired(page);
    expect(offsetRolls, "half-drop on a 640mm repeat needs 4 rolls").toBe("4");

    // Cut length is extended to clear the half-repeat: ceil(2700/640)*640 + 320.
    await expect(page.getByText(/3520/).first()).toBeVisible();
    // The warning is what the client actually reads on the quote.
    await expect(page.getByText(/half-drop match/i).first()).toBeVisible();
    await expect(page.getByText(/adds 1 roll/i).first()).toBeVisible();

    // ── Switch to free match ──────────────────────────────────────────────
    await page.locator("label", { hasText: "Pattern match" }).locator("select").selectOption("FREE");
    await page.waitForTimeout(300);

    const freeRolls = await rollsRequired(page);
    expect(freeRolls, "a free match on the same wall needs 3 rolls").toBe("3");
    expect(
      Number(offsetRolls) - Number(freeRolls),
      "the pattern match must cost exactly one roll",
    ).toBe(1);

    // No half-drop warning once the repeat no longer applies.
    await expect(page.getByText(/half-drop match/i)).toHaveCount(0);
  });

  test("the estimator reports the engine version it used", async ({ page }) => {
    await page.goto("/measure");
    await expect(page.getByText("Wall width (mm)")).toBeVisible({ timeout: 15_000 });
    // Traceability: a quote must be attributable to the formula that produced
    // it (§7.7.1). Anything other than the kernel version means a second
    // engine has crept back in.
    await expect(page.getByText(/wallpaper@2\.0\.0/)).toBeVisible();
  });
});
