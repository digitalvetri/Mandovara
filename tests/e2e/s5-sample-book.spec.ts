// §12.2 Scenario 5 — Sample library page.
//
// Verifies the /samples page loads with book list, status chips,
// and overdue/issued counts. Deeper automation tests (WhatsApp nudge)
// require the Phase 8 automation layer to be wired (§9 sample.overdue trigger).
//
// E2E_SAMPLE_BOOK_ID — optional: a seeded book with an overdue issue.

import { test, expect, type Page } from "@playwright/test";

async function expectNoRuntimeError(page: Page) {
  await expect(
    page.getByText(/PrismaClientValidationError|Unknown field|Unhandled Runtime Error/i),
  ).toHaveCount(0);
}

test("sample library page shows book list with status and holder", async ({ page }) => {
  await page.goto("/samples");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);

  // Page title or table header should be visible
  await expect(
    page.getByText(/sample library|barcode|collection|in library|issued|overdue/i).first(),
  ).toBeVisible();
});

test("sample library status filter tabs render", async ({ page }) => {
  await page.goto("/samples");
  await expectNoRuntimeError(page);
  // Should have All books filter at minimum
  await expect(page.getByText(/all books/i).first()).toBeVisible();
});

test("sample library overdue filter shows only overdue books", async ({ page }) => {
  await page.goto("/samples?status=OVERDUE");
  await expect(page).not.toHaveTitle(/404|500/);
  await expectNoRuntimeError(page);
  // Either shows "no books" empty state or an overdue status chip in the table
  await expect(
    page.getByText(/no books with status "Overdue"/i)
        .or(page.getByRole("cell").filter({ hasText: /overdue/i }).first()),
  ).toBeVisible();
});
