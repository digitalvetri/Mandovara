import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

async function postAdjustment({ direction, qty, rate, note }) {
  await page.goto("http://localhost:3000/inventory/adjust", { waitUntil: "networkidle" });
  const productSel = page.locator("select").nth(0);
  const value = await productSel.locator("option", { hasText: /FIT-001/ }).first().getAttribute("value");
  console.log("  picked product value:", value);
  await productSel.selectOption(value);
  if (direction === "OUT") {
    await page.getByRole("button", { name: "Stock OUT" }).click();
  }
  const inputs = page.locator("input[inputmode=decimal]");
  await inputs.nth(0).fill(String(qty));
  await inputs.nth(1).fill(String(rate));
  await page.locator("input[placeholder*='Optional']").fill(note);
  await page.screenshot({ path: `inv-form-${direction}-${qty}.png`, fullPage: true });
  await page.getByRole("button", { name: "Post adjustment" }).click({ timeout: 5000 });
}

// Step 1: +50 IN @ ₹12,500
await postAdjustment({ direction: "IN", qty: 50, rate: 12500, note: "Opening" });
await page.waitForURL(/\/inventory\/[^/]+$/, { timeout: 15000 });
console.log("first adjustment (IN 50) landed on:", page.url());
await page.screenshot({ path: "inv-after-in50.png", fullPage: true });

// Step 2: -10 OUT @ ₹12,500
await postAdjustment({ direction: "OUT", qty: 10, rate: 12500, note: "Damaged in transit" });
await page.waitForURL(/\/inventory\/[^/]+$/, { timeout: 15000 });
console.log("second adjustment (OUT 10) landed on:", page.url());
await page.screenshot({ path: "inv-after-out10.png", fullPage: true });

// Step 3: attempt OUT 100 — should be blocked ("Would push stock to -60")
await page.goto("http://localhost:3000/inventory/adjust", { waitUntil: "networkidle" });
const productSel = page.locator("select").nth(0);
const value = await productSel.locator("option", { hasText: /FIT-001/ }).first().getAttribute("value");
await productSel.selectOption(value);
await page.getByRole("button", { name: "Stock OUT" }).click();
const inputs = page.locator("input[inputmode=decimal]");
await inputs.nth(0).fill("100");
await inputs.nth(1).fill("12500");
await page.getByRole("button", { name: "Post adjustment" }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: "inv-out100-blocked.png", fullPage: true });

await browser.close();
console.log("done");
