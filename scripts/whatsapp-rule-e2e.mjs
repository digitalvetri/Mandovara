import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

await page.goto("http://localhost:3000/whatsapp", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Add rule/ }).click();
await page.waitForTimeout(200);
const nameInput = page.locator("input[placeholder*='Payment due']");
await nameInput.fill("Test — Payment reminder");
await page.getByRole("button", { name: /Save rule/ }).click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "wa-after-add.png", fullPage: true });
console.log("submitted");

await browser.close();
