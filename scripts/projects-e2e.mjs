import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

// Step 1: create a project for Sunrise Cafe
await page.goto("http://localhost:3000/projects/new", { waitUntil: "networkidle" });
await page.locator("form input").nth(0).fill("Sunrise Cafe — Full interior fitout");
const clientSel = page.locator("form select").first();
const cValue = await clientSel.locator("option", { hasText: /Sunrise/ }).first().getAttribute("value");
await clientSel.selectOption(cValue);
// Order value
await page.locator("form input[inputmode=decimal]").fill("500000");
await page.getByRole("button", { name: "Create project" }).click();
await page.waitForURL(/\/projects\/(?!new$)[^/]+$/, { timeout: 15000 });
console.log("project created:", page.url());
await page.screenshot({ path: "prj-detail-fresh.png", fullPage: true });

// Step 2: add a milestone
await page.getByRole("button", { name: "Add milestone" }).click();
await page.waitForTimeout(150);
await page.locator("form input").filter({ hasNot: page.locator("[type=date]") }).filter({ hasNot: page.locator("[inputmode=decimal]") }).first().fill("Site measurement & design");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForLoadState("networkidle");

// Step 3: add a task
await page.getByRole("button", { name: "Add task" }).click();
await page.waitForTimeout(150);
const taskInput = page.locator("form input").filter({ hasNot: page.locator("[type=date]") }).last();
await taskInput.fill("Buy 20 hinges from Coimbatore Hardware");
await page.getByRole("button", { name: "Add", exact: true }).click();
await page.waitForLoadState("networkidle");

// Step 4: add a site log
await page.getByRole("button", { name: "Add log" }).click();
await page.waitForTimeout(150);
await page.locator("textarea").fill("Kitchen wall demolition complete; carpenter arriving tomorrow.");
await page.locator("input[placeholder*='Rainy']").fill("Cloudy");
await page.locator("input[inputmode=numeric]").fill("6");
await page.getByRole("button", { name: "Add log" }).last().click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "prj-detail-populated.png", fullPage: true });

// Step 5: mark milestone complete
await page.getByRole("button", { name: /Complete/ }).click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "prj-milestone-done.png", fullPage: true });

await browser.close();
console.log("done");
