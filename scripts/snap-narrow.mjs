import { chromium } from "@playwright/test";

const url = process.env.URL ?? "http://localhost:3000/";
const out = process.env.OUT ?? "narrow.png";
const w = Number(process.env.W ?? "800");
const h = Number(process.env.H ?? "900");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(`wrote ${out} at ${w}px`);
