import { chromium } from "@playwright/test";

const url = process.env.URL ?? "http://localhost:3000/";
const out = process.env.OUT ?? "dashboard-snap.png";

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out}`);
