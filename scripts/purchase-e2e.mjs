import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

page.on("pageerror", (e) => console.error("PAGE ERROR:", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("CONSOLE:", m.text()); });

// Step 1: create a vendor
await page.goto("http://localhost:3000/purchase/vendors/new", { waitUntil: "networkidle" });
// The form's inputs: [name, mobile, email, gstin, pan, stateCode, paymentTerms].
// Some are type=email/tel/number, first plain input is `name`.
const allInputs = page.locator("form input");
await allInputs.nth(0).fill("Coimbatore Hardware Co");
await allInputs.nth(1).fill("9812345670");
// paymentTerms is populated by defaultValues (30), state defaulted to 33 — leave them.
await page.getByRole("button", { name: "Create vendor" }).click();
await page.waitForURL(/\/purchase\/vendors\/(?!new$)[^/]+$/, { timeout: 15000 });
console.log("vendor created:", page.url());

// Step 2: create a PO with one line (30 nos × ₹9,500)
await page.goto("http://localhost:3000/purchase/new", { waitUntil: "networkidle" });
const vendorSel = page.locator("select").first();
const vValue = await vendorSel.locator("option", { hasText: /Coimbatore Hardware/ }).first().getAttribute("value");
await vendorSel.selectOption(vValue);
const productSel = page.locator("tbody tr select").first();
const pValue = await productSel.locator("option", { hasText: /FIT-001/ }).first().getAttribute("value");
await productSel.selectOption(pValue);
const inputs = page.locator("tbody tr input[inputmode=decimal]");
await inputs.nth(0).fill("30");
await inputs.nth(1).fill("9500");
await page.getByRole("button", { name: "Issue purchase order" }).click();
await page.waitForURL(/\/purchase\/(?!new$)[^/]+$/, { timeout: 15000 });
console.log("PO created:", page.url());
await page.screenshot({ path: "po-detail-fresh.png", fullPage: true });

// Step 3: post GRN of 20 nos (partial)
await page.getByRole("button", { name: "Post GRN" }).click();
await page.waitForTimeout(200);
await page.locator("input[placeholder*='TN']").fill("TN 39 XY 5555");
await page.locator("input[placeholder*='INV-']").fill("VEND-INV-9911");
const grnInputs = page.locator("tbody tr input[inputmode=decimal]");
await grnInputs.first().fill("20");
await page.getByRole("button", { name: "Post GRN" }).last().click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "po-after-grn20.png", fullPage: true });
console.log("first GRN posted");

// Step 4: post remaining 10 → PO should become RECEIVED
await page.getByRole("button", { name: "Post GRN" }).click();
await page.waitForTimeout(200);
const grnInputs2 = page.locator("tbody tr input[inputmode=decimal]");
await grnInputs2.first().fill("10");
await page.getByRole("button", { name: "Post GRN" }).last().click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: "po-after-grn30.png", fullPage: true });
console.log("second GRN posted");

await browser.close();
console.log("done");
