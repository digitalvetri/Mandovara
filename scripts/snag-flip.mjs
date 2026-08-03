import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

await page.goto("http://localhost:3000/installations", { waitUntil: "networkidle" });
// Pick the first snag select and change to RESOLVED
const select = page.locator("select").last();
await select.selectOption("RESOLVED");
await page.waitForTimeout(1500);
await page.screenshot({ path: "snag-after-flip.png", fullPage: true });

await browser.close();
console.log("done");
