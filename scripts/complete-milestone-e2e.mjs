import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));

// Go to projects list, open the first project.
await page.goto("http://localhost:3000/projects", { waitUntil: "networkidle" });
const first = page.locator("tbody tr a").first();
if (await first.count() === 0) { console.log("no projects"); await browser.close(); process.exit(0); }
await first.click();
await page.waitForURL(/\/projects\/[^/]+$/);

// Click the first "Complete" button on a pending milestone.
const btn = page.getByRole("button", { name: /Complete/ }).first();
await btn.waitFor({ state: "visible", timeout: 5000 });
await btn.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "project-after-complete.png", fullPage: true });
console.log("clicked complete");

await browser.close();
