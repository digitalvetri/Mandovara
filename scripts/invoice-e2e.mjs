import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

// Land on orders, open the first one (our partial-dispatch SO).
await page.goto("http://localhost:3000/orders", { waitUntil: "networkidle" });
await page.locator("tbody tr a").first().click();
await page.waitForURL(/\/orders\/[^/]+$/);

// Click "Create invoice"
await page.getByRole("button", { name: "Create invoice" }).click();
await page.waitForURL(/\/invoicing\/[^/]+$/, { timeout: 15000 });
console.log("landed on invoice:", page.url());
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "inv-detail-fresh.png", fullPage: true });

// Open the cancel dialog and try to cancel.
await page.getByRole("button", { name: "Cancel invoice" }).click();
await page.waitForTimeout(200);
// Type reason
await page.locator("textarea").fill("Duplicate — will re-issue with correct HSN");
// Get invoice number from title
const number = (await page.locator("h1").textContent())?.trim() ?? "";
console.log("cancelling invoice:", number);
// Type the number
const numberInput = page.locator("input[placeholder]").last();
await numberInput.fill(number);
await page.getByRole("button", { name: "Cancel invoice" }).last().click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "inv-detail-cancelled.png", fullPage: true });

await browser.close();
console.log("done: inv-detail-fresh.png + inv-detail-cancelled.png");
