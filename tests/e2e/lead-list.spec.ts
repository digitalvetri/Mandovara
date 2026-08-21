import { test, expect } from "@playwright/test";

test.describe("Lead List — Phase 2 PDF spec", () => {
  test("renders filters and leads table", async ({ page }) => {
    await page.goto("/leads");

    // Filter tabs are present
    await expect(page.getByRole("button", { name: "Won", exact: true })).toBeVisible();
    // Filters row is present
    await expect(page.locator('input[type="search"]')).toBeVisible();
    // Table or empty state renders
    const hasTable = (await page.locator("table").count()) > 0;
    const hasEmpty = (await page.getByText(/no leads/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });

  test("status tabs include key stages including Qualified", async ({ page }) => {
    await page.goto("/leads");
    const tabs = ["All", "New", "Qualified", "Won", "Lost"];
    for (const label of tabs) {
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  });

  test("table layout shows customer name, status, mobile and action buttons on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/leads");
    // Table-based layout
    await expect(page.getByRole("link", { name: "New Lead", exact: true })).toBeVisible();
    const hasRows = (await page.locator('a[href^="tel:"]').count()) > 0;
    if (hasRows) {
      await expect(page.locator('a[href^="https://wa.me/"]').first()).toBeVisible();
      await expect(page.getByRole("link", { name: /details/i }).first()).toBeVisible();
    } else {
      await expect(page.getByText(/no leads/i)).toBeVisible();
    }
  });

  test("clicking status tab filters the table", async ({ page }) => {
    await page.goto("/leads");
    await page.getByRole("button", { name: "Won", exact: true }).click();
    await expect(page).toHaveURL(/status=WON/);
  });

  test("search filters leads", async ({ page }) => {
    await page.goto("/leads");
    const searchInput = page.locator('input[type="search"]');
    await searchInput.scrollIntoViewIfNeeded();
    await searchInput.fill("Binu");
    await searchInput.press("Enter");
    await expect(page).toHaveURL(/q=Binu/);
  });

  test("priority filter toggles correctly", async ({ page }) => {
    await page.goto("/leads");
    await page.getByRole("button", { name: "Hot", exact: true }).click();
    await expect(page).toHaveURL(/priority=HOT/);
    await page.getByRole("button", { name: "Hot", exact: true }).click();
    await expect(page).not.toHaveURL(/priority=HOT/);
  });

  test("clear filters button removes active filters", async ({ page }) => {
    await page.goto("/leads?priority=HOT&source=WHATSAPP");
    await expect(page.getByRole("button", { name: /clear/i })).toBeVisible();
    await page.getByRole("button", { name: /clear/i }).click();
    await expect(page).not.toHaveURL(/priority=HOT/);
  });

  test("mobile layout shows leads table or empty state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/leads");
    await expect(page.getByRole("link", { name: "New Lead", exact: true })).toBeVisible();
    const hasTable = (await page.locator("table").count()) > 0;
    const hasEmpty = (await page.getByText(/no leads/i).count()) > 0;
    expect(hasTable || hasEmpty).toBe(true);
  });
});
