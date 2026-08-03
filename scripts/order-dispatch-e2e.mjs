import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

// Land on the quotations list, open the first one.
await page.goto("http://localhost:3000/quotations", { waitUntil: "networkidle" });
const firstQuote = page.locator("tbody tr a").first();
const quoteNumber = await firstQuote.textContent();
console.log("opening quote:", quoteNumber);
await firstQuote.click();
await page.waitForURL(/\/quotations\/[^/]+$/, { timeout: 10000 });

// Drive DRAFT → SENT → ACCEPTED → CONVERTED
async function clickStatusButton(label) {
  const btn = page.getByRole("button", { name: label });
  await btn.waitFor({ state: "visible", timeout: 5000 });
  await btn.click();
  await page.waitForLoadState("networkidle");
}

await clickStatusButton("Send");
await clickStatusButton("Accepted");
await clickStatusButton("Convert to order");

// Should now be on /orders/[id]
await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 10000 });
console.log("landed on order:", page.url());
await page.screenshot({ path: "so-detail-fresh.png", fullPage: true });

// Open the dispatch form and dispatch 3 of the 5.
await page.getByRole("button", { name: "New dispatch" }).click();
await page.waitForTimeout(200);
const qtyInputs = page.locator("input[inputmode=decimal]");
await qtyInputs.first().fill("3");
await page.locator('input[placeholder*="TN"]').fill("TN 39 AB 1234");
await page.locator('input[placeholder*="VRL"]').fill("VRL Logistics");
await page.getByRole("button", { name: "Post dispatch" }).click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "so-detail-partial.png", fullPage: true });
console.log("posted first dispatch");

// Try to over-dispatch — attempt 10 more (only 2 pending). Should show error.
await page.getByRole("button", { name: "New dispatch" }).click();
await page.waitForTimeout(200);
await page.locator("input[inputmode=decimal]").first().fill("10");
await page.getByRole("button", { name: "Post dispatch" }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "so-overdispatch-blocked.png", fullPage: true });

await browser.close();
console.log("done: so-detail-fresh.png + so-detail-partial.png + so-overdispatch-blocked.png");
