import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

await page.goto("http://localhost:3000/quotations/new", { waitUntil: "networkidle" });

// Pick the first non-empty client
await page.locator("select").first().selectOption({ index: 1 });
// Set quantity 5, rate 12500, discount 10
const inputs = page.locator("tbody tr input[inputmode=decimal]");
const productSelect = page.locator("tbody tr select");
await productSelect.selectOption({ index: 1 });

// Wait for defaults to populate (rate autofills from MRP)
await page.waitForTimeout(200);

await inputs.nth(0).fill("5");    // quantity
await inputs.nth(1).fill("12500"); // rate (₹12,500)
await inputs.nth(2).fill("10");   // discount 10%

await page.screenshot({ path: "qt-new-filled.png", fullPage: true });

await page.getByRole("button", { name: "Create quotation" }).click();

// Wait for navigation to /quotations/[id] (not /new).
await page.waitForURL(/\/quotations\/(?!new$)[^/]+$/, { timeout: 15000 });
console.log("navigated to:", page.url());
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "qt-detail-final.png", fullPage: true });
console.log("wrote qt-new-filled.png + qt-detail-final.png");

await browser.close();
