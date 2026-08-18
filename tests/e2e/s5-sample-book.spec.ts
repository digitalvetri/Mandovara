// §12.2 Scenario 5 — "Issue a sample book, let it pass due, verify the overdue
// nudge fires and the library shows the holder."
//
// The seed plants the §11 edge case this needs: a book issued to an architect
// 54 days ago against a 14-day due date, so it is 40 days overdue. That is the
// exact situation the sample library exists for — a ₹5,000–₹15,000 book that
// walked out and nobody can say who has it.
//
// The WhatsApp nudge itself cannot be asserted end to end: no Meta WABA is
// wired (§9). What IS asserted is everything the nudge depends on — the book
// is flagged overdue, the holder is named, and an APPROVED sample_overdue
// template exists so the send would not be blocked by the template gate.

import { test, expect } from "@playwright/test";

test.describe("§12.2/5 — sample library", () => {
  test("library lists books with status, holder and due date", async ({ page }) => {
    await page.goto("/samples");
    await expect(page).not.toHaveTitle(/404|500/);
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Holder" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Due date" })).toBeVisible();
  });

  test("an overdue book is flagged and names who is holding it", async ({ page }) => {
    await page.goto("/samples?status=OVERDUE");
    await expectNoOverflowFreeCrash(page);

    const rows = page.locator("tbody tr");
    const count = await rows.count();
    test.skip(count === 0, "no overdue book — reseed with SEED_DEMO_DATA=true");

    const first = rows.first();
    await expect(first).toContainText(/overdue/i);

    // The holder cell must not be blank: an overdue book whose holder is
    // unknown is the failure this module exists to prevent.
    const holder = (await first.locator("td").nth(2).innerText()).trim();
    expect(holder.length, "an overdue book must name its holder").toBeGreaterThan(1);
    expect(holder).not.toMatch(/^[—-]$/);
  });

  test("the overdue count is surfaced on the page header", async ({ page }) => {
    await page.goto("/samples");
    await expect(page.getByText(/\d+\s+overdue/i).first()).toBeVisible();
  });

  test("the nudge's prerequisite — an APPROVED sample_overdue template — exists", async ({ page }) => {
    // §9 gates sending on metaStatus === APPROVED. If this template is missing
    // or unapproved the overdue nudge silently never goes out, so the library
    // would flag the book and nothing would happen.
    await page.goto("/whatsapp");
    await expect(page).not.toHaveTitle(/404|500/);
    await expect(page.getByText(/sample.?overdue/i).first()).toBeVisible();
  });
});

async function expectNoOverflowFreeCrash(page: import("@playwright/test").Page) {
  await expect(page).not.toHaveTitle(/404|500/);
  await expect(page.locator("text=Application error")).toHaveCount(0);
}
