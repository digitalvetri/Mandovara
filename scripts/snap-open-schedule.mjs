import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Schedule" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "schedule-open-dashboard.png", fullPage: false });

await browser.close();
console.log("wrote schedule-open-dashboard.png");
