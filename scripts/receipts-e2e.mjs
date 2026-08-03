import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

async function pickSunrise() {
  const select = page.locator("select").first();
  const value = await select.locator("option", { hasText: /Sunrise/ }).first().getAttribute("value");
  await select.selectOption(value);
}

async function waitForReceiptRedirect() {
  // Must land on /accounts/<id>, not /accounts/new.
  await page.waitForURL(/\/accounts\/(?!new$)[^/]+$/, { timeout: 15000 });
}

// Step 1: mint a fresh invoice from the existing SO.
await page.goto("http://localhost:3000/orders", { waitUntil: "networkidle" });
await page.locator("tbody tr a").first().click();
await page.waitForURL(/\/orders\/[^/]+$/);
await page.getByRole("button", { name: "Create invoice" }).click();
await page.waitForURL(/\/invoicing\/(?!new$)[^/]+$/, { timeout: 15000 });
const invoiceNumber = (await page.locator("h1").textContent())?.trim() ?? "";
console.log("new invoice:", invoiceNumber);

// Step 2: record a PARTIAL receipt of ₹30,000
await page.goto("http://localhost:3000/accounts/new", { waitUntil: "networkidle" });
await pickSunrise();
await page.waitForSelector("tbody tr input[inputmode=decimal]", { timeout: 10000 });
await page.locator('input[placeholder*="25000"]').fill("30000");
await page.getByRole("button", { name: /Auto-allocate/ }).click();
await page.waitForTimeout(150);
await page.screenshot({ path: "rc-partial-preview.png", fullPage: true });
await page.getByRole("button", { name: "Record receipt" }).click();
await waitForReceiptRedirect();
console.log("first receipt saved:", page.url());
await page.screenshot({ path: "rc-partial-detail.png", fullPage: true });

// Step 3: record a FULL remaining receipt to close whatever invoice is still open
await page.goto("http://localhost:3000/accounts/new", { waitUntil: "networkidle" });
await pickSunrise();
await page.waitForSelector("tbody tr input[inputmode=decimal]", { timeout: 10000 });
await page.locator('input[placeholder*="25000"]').fill("36375");
await page.getByRole("button", { name: /Auto-allocate/ }).click();
await page.waitForTimeout(150);
await page.getByRole("button", { name: "Record receipt" }).click();
await waitForReceiptRedirect();
console.log("second receipt saved:", page.url());
await page.screenshot({ path: "rc-paid-detail.png", fullPage: true });

// Step 4: view /invoicing to see status
await page.goto("http://localhost:3000/invoicing?status=ALL", { waitUntil: "networkidle" });
await page.screenshot({ path: "rc-invoice-status.png", fullPage: true });

await browser.close();
console.log("done");
