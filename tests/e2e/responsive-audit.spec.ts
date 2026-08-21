// Responsiveness audit — measures horizontal overflow across every static
// route at three viewports.
//
// The signal: document.scrollWidth > innerWidth means the page scrolls
// sideways, which on a phone is the single most visible layout failure.
// For each offending page we also name the widest offending element so the
// fix is actionable rather than "something is too wide".
//
// Run: npx playwright test responsive-audit --project=chromium

import { test, expect, type Page } from "@playwright/test";

const ROUTES = [
  "/", "/accounts", "/accounts/new", "/admin", "/admin/roles",
  "/architects", "/architects/new", "/attendance", "/calendar", "/clients",
  "/clients/new", "/documents", "/employee", "/inventory",
  "/invoicing", "/invoicing/new", "/leads",
  "/leads/new", "/make", "/measure", "/measurements", "/notifications",
  "/orders", "/payroll", "/products", "/products/new",
  "/profile", "/projects", "/projects/new", "/purchase",
  "/purchase/new", "/purchase/requests", "/purchase/vendors",
  "/purchase/vendors/new", "/quotations", "/quotations/new", "/quotations/quick",
  "/reports", "/samples", "/site-visits", "/tasks", "/whatsapp",
  "/m/attendance", "/m/measure/conflicts",
];

const VIEWPORTS = [
  { name: "mobile", width: 390,  height: 844  },  // iPhone 14 / Pixel-class
  { name: "tablet", width: 768,  height: 1024 },
  { name: "desktop", width: 1440, height: 900  },
];

interface Overflow {
  route: string;
  scrollW: number;
  innerW: number;
  worst: string;
}

async function measure(page: Page, route: string): Promise<Overflow | null> {
  await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(250);
  return page.evaluate((r) => {
    const de = document.documentElement;
    const innerW = window.innerWidth;
    // 1px of slack absorbs sub-pixel rounding.
    if (de.scrollWidth <= innerW + 1) return null;

    // Name the widest element whose right edge passes the viewport.
    let worst = "(unidentified)";
    let worstRight = innerW;
    document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (rect.right > worstRight + 1) {
        worstRight = rect.right;
        const cls = (el.className || "").toString().split(/\s+/).slice(0, 3).join(".");
        worst = `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} → right:${Math.round(rect.right)}px`;
      }
    });
    return { route: r, scrollW: de.scrollWidth, innerW, worst };
  }, route);
}

for (const vp of VIEWPORTS) {
  test(`no horizontal overflow at ${vp.name} (${vp.width}px)`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const offenders: Overflow[] = [];
    for (const route of ROUTES) {
      const o = await measure(page, route);
      if (o) offenders.push(o);
    }

    if (offenders.length) {
      console.log(`\n=== ${vp.name} (${vp.width}px): ${offenders.length} route(s) overflow ===`);
      for (const o of offenders) {
        console.log(`  ${o.route}  scrollW=${o.scrollW} (+${o.scrollW - o.innerW}px)  ${o.worst}`);
      }
    } else {
      console.log(`\n=== ${vp.name} (${vp.width}px): clean ===`);
    }
    expect(offenders.map((o) => `${o.route} +${o.scrollW - o.innerW}px`)).toEqual([]);
  });
}
