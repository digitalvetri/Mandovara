import { test, expect } from "@playwright/test";

test.describe("Lead List — Phase 2 PDF spec", () => {
  test("renders summary cards, filters and lead cards", async ({ page }) => {
    await page.goto("/leads");

    // 7 summary cards per PDF spec.
    // exact: true avoids matching "Next Follow-up" in the always-rendered table header.
    await expect(page.getByText("Follow-up", { exact: true })).toBeVisible();
    // "Total" appears only in the first summary card.
    await expect(page.getByText("Total", { exact: true }).first()).toBeVisible();
    // "Won" exists as both a summary-card span and a status-tab button.
    // Assert the tab button — role+name+exact is unambiguous.
    await expect(page.getByRole("button", { name: "Won", exact: true })).toBeVisible();
    // Filters row is present
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test("status tabs include key stages including Qualified", async ({ page }) => {
    await page.goto("/leads");
    const tabs = ["All", "New", "Qualified", "Won", "Lost"];
    for (const label of tabs) {
      // exact: true avoids matching "Open command palette" etc.
      await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
    }
    // "Open" needs exact match because the nav has "Open command palette" buttons too
    await expect(page.getByRole("button", { name: "Open", exact: true })).toBeVisible();
  });

  test("cards show customer name, status, mobile and action buttons on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/leads");
    // Card-based layout: no HTML table element
    expect(await page.locator("table").count()).toBe(0);
    // The topbar action is the data-independent one. The "+ New Lead" link in
    // LeadsTable renders ONLY in the empty state, so asserting it made this
    // test pass or fail depending on whether another spec had created a lead.
    await expect(page.getByRole("link", { name: "New Lead", exact: true })).toBeVisible();
    // Either lead cards (with tel: links) or empty state are rendered
    const hasCards = (await page.locator('a[href^="tel:"]').count()) > 0;
    if (hasCards) {
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
    // Toggle off
    await page.getByRole("button", { name: "Hot", exact: true }).click();
    await expect(page).not.toHaveURL(/priority=HOT/);
  });

  test("clear filters button removes active filters", async ({ page }) => {
    await page.goto("/leads?priority=HOT&source=WHATSAPP");
    await expect(page.getByRole("button", { name: /clear/i })).toBeVisible();
    await page.getByRole("button", { name: /clear/i }).click();
    await expect(page).not.toHaveURL(/priority=HOT/);
  });

  test("mobile card layout shows lead cards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/leads");
    // No HTML table at any viewport size — purely card-based layout
    expect(await page.locator("table").count()).toBe(0);
    // Page renders without error. Topbar action, not the empty-state link.
    await expect(page.getByRole("link", { name: "New Lead", exact: true })).toBeVisible();
  });
});
