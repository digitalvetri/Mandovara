import { test, expect } from "@playwright/test";

// Helper selectors — EntityForm.Field uses <div> labels, not <label htmlFor>
// so we match by the input's `name` attribute (set by react-hook-form's register())
const sel = {
  name:            'input[name="name"]',
  mobile:          'input[name="mobile"]',
  email:           'input[name="email"]',
  city:            'input[name="city"]',
  address:         'input[name="address"]',
  source:          'select[name="source"]',
  priority:        'select[name="priority"]',
  estimatedBudget: 'input[name="estimatedBudget"]',
  ownerId:         'select[name="ownerId"]',
  requirement:     'textarea[name="requirement"]',
  submit:          'button[type="submit"]',
};

test.describe("New Lead Form — PDF spec", () => {
  test("renders with the 10 required fields and no removed fields", async ({ page }) => {
    await page.goto("/leads/new");
    await page.waitForLoadState("load");

    // ── Fields that MUST be present ──────────────────────────────────
    await expect(page.locator(sel.name)).toBeVisible();
    await expect(page.locator(sel.mobile)).toBeVisible();
    await expect(page.locator(sel.email)).toBeVisible();
    await expect(page.locator(sel.city)).toBeVisible();
    await expect(page.locator(sel.address)).toBeVisible();
    await expect(page.locator(sel.requirement)).toBeVisible();
    await expect(page.locator(sel.source)).toBeVisible();
    await expect(page.locator(sel.priority)).toBeVisible();
    await expect(page.locator(sel.ownerId)).toBeVisible();
    await expect(page.locator(sel.estimatedBudget)).toBeVisible();

    // ── Fields that must NOT be present ──────────────────────────────
    await expect(page.locator('input[name="altMobile"]')).not.toBeAttached();
    await expect(page.locator('input[name="pincode"]')).not.toBeAttached();
    await expect(page.locator('input[name="projectName"]')).not.toBeAttached();
    await expect(page.locator('select[name="projectType"]')).not.toBeAttached();
  });

  test("lead source dropdown includes Facebook, Google, Advertisement", async ({ page }) => {
    await page.goto("/leads/new");
    await page.waitForLoadState("load");

    await expect(page.locator(`${sel.source} option[value="FACEBOOK"]`)).toHaveCount(1);
    await expect(page.locator(`${sel.source} option[value="GOOGLE"]`)).toHaveCount(1);
    await expect(page.locator(`${sel.source} option[value="ADVERTISEMENT"]`)).toHaveCount(1);
  });

  test("priority dropdown defaults to Warm", async ({ page }) => {
    await page.goto("/leads/new");
    await page.waitForLoadState("load");
    await expect(page.locator(sel.priority)).toHaveValue("WARM");
  });

  test("required field validation fires before submit", async ({ page }) => {
    await page.goto("/leads/new");
    await page.waitForLoadState("load");
    await page.locator(sel.submit).click();
    // react-hook-form fires inline validation — error text appears on the page
    await expect(page.getByText(/customer name is required/i)).toBeVisible();
  });

  test("creates a lead and navigates to the lead detail page", async ({ page }) => {
    await page.goto("/leads/new");
    await page.waitForLoadState("load");

    await page.locator(sel.name).fill("Playwright Test Lead");
    await page.locator(sel.mobile).fill("9876543210");
    await page.locator(sel.source).selectOption("WEBSITE");
    // Priority pre-selects WARM — no change needed

    // Pick the first real option in the sales executive dropdown
    const firstOwnerOption = page.locator(`${sel.ownerId} option:not([disabled]):not([value=""])`).first();
    const firstOwnerValue = await firstOwnerOption.getAttribute("value");
    if (firstOwnerValue) await page.locator(sel.ownerId).selectOption(firstOwnerValue);

    await page.locator(sel.submit).click();

    // Should navigate directly to the lead detail page (no success animation)
    await expect(page).toHaveURL(/\/leads\/[a-z0-9]+$/, { timeout: 8000 });
    await expect(page.getByText("Playwright Test Lead")).toBeVisible({ timeout: 4000 });
  });
});
