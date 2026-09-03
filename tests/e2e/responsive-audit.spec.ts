// Responsiveness gate — the checks that catch what a phone actually shows.
//
// This used to measure one thing (document overflow) across static routes at
// three viewports, and it reported "clean" for weeks while the owner sent
// photographs of broken screens. Two blind spots caused that:
//
//   1. It only visited list pages. Every layout defect reported between
//      2026-08-28 and 2026-08-30 was on a DETAIL page — the brand page with
//      its buttons printed over the title, the project header squeezed to
//      four lines, the payment ledger overlapping its own action. A sweep of
//      index routes could never have seen one of them.
//
//   2. It only asked "does the page scroll sideways". A control drawn on top
//      of a heading does not scroll the page. Neither does a table that hides
//      four columns and then stretches the rest across 900px of forced width.
//
// So it now discovers detail routes the way a person reaches them (click the
// first row of each list), adds 320px — the real floor, not 390 — and checks
// six failure classes instead of one. Each failure names the element, so a
// red run tells you what to fix rather than that something, somewhere, is
// wrong.

import { test, expect, type Page } from "@playwright/test";

const STATIC_ROUTES = [
  "/", "/accounts", "/accounts/new", "/admin", "/admin/roles",
  "/architects", "/architects/new", "/attendance", "/calendar", "/catalogues",
  "/clients", "/clients/new", "/documents", "/employee", "/inventory",
  "/inventory/sold",
  "/invoicing", "/invoicing/new", "/leads", "/leads/new", "/make", "/measure",
  "/measurements", "/notifications", "/orders", "/payroll", "/products",
  "/products/new", "/profile", "/projects", "/projects/new", "/purchase",
  "/purchase/new", "/purchase/requests", "/purchase/vendors",
  "/purchase/vendors/new", "/quotations", "/quotations/new", "/quotations/quick",
  "/reports", "/samples", "/site-visits", "/tasks", "/whatsapp",
  "/m/attendance", "/m/measure/conflicts",
];

/** Detail pages, reached by clicking the first row of the list that owns them. */
const DETAIL_SOURCES: [list: string, linkSelector: string][] = [
  ["/leads",       'a[href^="/leads/"]'],
  ["/clients",     'a[href^="/clients/"]'],
  ["/projects",    'a[href^="/projects/"]'],
  ["/quotations",  'a[href^="/quotations/"]'],
  ["/invoicing",   'a[href^="/invoicing/"]'],
  ["/site-visits", 'a[href^="/site-visits/"]'],
  ["/products",    'a[href^="/products/brand/"]'],
  ["/admin",       'a[href^="/admin/employees/"]'],
];

const VIEWPORTS = [
  { name: "small mobile", width: 320,  height: 640  },  // iPhone SE, older Android
  { name: "mobile",       width: 390,  height: 844  },  // iPhone 14 / Pixel-class
  { name: "tablet",       width: 768,  height: 1024 },
  { name: "desktop",      width: 1440, height: 900  },
];

/** Runs in the page. Returns one line per problem, or [] when the page is sound. */
function probeSource(): string[] {
  const vw = window.innerWidth;
  const problems: string[] = [];
  const label = (el: Element) => {
    const cls = (el.className || "").toString().trim().split(/\s+/).slice(0, 2).join(".");
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
  };

  // (1) The page itself scrolls sideways.
  const de = document.documentElement;
  if (de.scrollWidth > vw + 1) problems.push(`page scrolls sideways by ${de.scrollWidth - vw}px`);

  // (2) Content wider than the screen with no ancestor that can scroll it —
  //     i.e. genuinely unreachable, as opposed to an intentional side-scroller.
  const hasScrollingAncestor = (el: Element) => {
    let a = el.parentElement;
    while (a && a.tagName !== "BODY") {
      const ox = getComputedStyle(a).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
      a = a.parentElement;
    }
    return false;
  };
  for (const el of Array.from(document.querySelectorAll("main *"))) {
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) continue;
    if (b.width > vw + 1 && !hasScrollingAncestor(el)) {
      problems.push(`${label(el)} is ${Math.round(b.width)}px wide and cannot be scrolled to`);
      break; // one is enough to fail; the rest are usually its children
    }
  }

  // (3) A heading drawn on top of a control. This is what "the buttons are
  //     over the title" looks like to a machine.
  const heads = Array.from(document.querySelectorAll("main h1, main h2, main h3"));
  const controls = Array.from(document.querySelectorAll("main a, main button"));
  outer: for (const h of heads) {
    const hb = h.getBoundingClientRect();
    if (hb.width === 0 || hb.height === 0) continue;
    for (const c of controls) {
      if (h.contains(c) || c.contains(h)) continue;
      const cb = c.getBoundingClientRect();
      if (cb.width === 0 || cb.height === 0) continue;
      const overlaps =
        !(hb.right <= cb.left || hb.left >= cb.right || hb.bottom <= cb.top || hb.top >= cb.bottom);
      if (overlaps) {
        problems.push(
          `heading "${(h as HTMLElement).innerText.trim().slice(0, 24)}" overlaps ` +
          `control "${(c as HTMLElement).innerText.trim().slice(0, 24)}"`,
        );
        break outer;
      }
    }
  }

  // (4) Form controls under 16px. iOS zooms the page in on focus and leaves it
  //     zoomed; globals.css lifts these on coarse pointers, and this catches
  //     anything that sets its own size and escapes that rule.
  if (matchMedia("(pointer: coarse)").matches) {
    for (const el of Array.from(document.querySelectorAll("main input, main select, main textarea"))) {
      const type = (el as HTMLInputElement).type;
      if (type === "checkbox" || type === "radio") continue;
      if (el.getBoundingClientRect().width === 0) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) { problems.push(`${label(el)} font is ${fs}px — iOS will zoom on focus`); break; }
    }
  }

  // (5) Controls too small to hit. WCAG 2.5.8 puts the floor at 24x24 CSS px;
  //     globals.css lifts touch targets to 32, so this gates the standard and
  //     leaves headroom rather than failing on every pixel of drift.
  if (matchMedia("(pointer: coarse)").matches) {
    for (const el of Array.from(document.querySelectorAll("main a, main button, main [role=button]"))) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (getComputedStyle(el).display === "inline") continue;   // links inside a sentence
      const smallest = Math.min(b.width, b.height);
      if (smallest < 24) {
        problems.push(`${label(el)} is ${Math.round(b.width)}x${Math.round(b.height)} — under the 24px tap-target floor`);
        break;
      }
    }
  }

  // (6) A control that only appears on hover, on a device that cannot hover.
  if (matchMedia("(hover: none)").matches) {
    for (const el of Array.from(document.querySelectorAll("main a, main button"))) {
      if (el.getBoundingClientRect().width === 0) continue;
      if (parseFloat(getComputedStyle(el).opacity) < 0.05) {
        problems.push(`${label(el)} is invisible and needs a hover that a finger cannot produce`);
        break;
      }
    }
  }

  return problems;
}

async function auditRoute(page: Page, route: string): Promise<string[]> {
  const res = await page.goto(route, { waitUntil: "domcontentloaded" }).catch(() => null);
  if (!res) return [];                        // route unavailable in this fixture set
  if (res.status() >= 500) return [`${route} returned ${res.status()}`];
  if (res.status() === 404) return [];        // not every fixture exists
  await page.waitForTimeout(250);
  const problems = await page.evaluate(probeSource);
  return problems.map((p) => `${route} — ${p}`);
}

/** Click through to one real detail page per entity, so ids come from data. */
async function resolveDetailRoutes(page: Page): Promise<string[]> {
  const found: string[] = [];
  for (const [list, selector] of DETAIL_SOURCES) {
    await page.goto(list, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    await page.waitForTimeout(300);
    const href = await page.evaluate((sel) => {
      const candidate = Array.from(document.querySelectorAll(sel))
        .map((a) => a.getAttribute("href"))
        .find((h) => h && h.split("/").length >= 3 && !/\/(new|create|import|requests|vendors)$/.test(h));
      return candidate ?? null;
    }, selector).catch(() => null);
    if (href) found.push(href);
  }
  return found;
}

for (const vp of VIEWPORTS) {
  test(`layout holds at ${vp.name} (${vp.width}px)`, async ({ browser }, testInfo) => {
    test.setTimeout(600_000);

    // A fresh context rather than resizing the shared page: the touch checks
    // read `pointer: coarse` and `hover: none`, and those only report true
    // when the context emulates a touch device. Resizing a desktop page would
    // silently skip exactly the two checks that matter most on a phone.
    const context = await browser.newContext({
      viewport:      { width: vp.width, height: vp.height },
      hasTouch:      vp.width < 1024,
      isMobile:      vp.width < 1024,
      storageState:  testInfo.project.use.storageState,
      baseURL:       testInfo.project.use.baseURL,
    });
    const page = await context.newPage();

    const routes = [...STATIC_ROUTES, ...(await resolveDetailRoutes(page))];
    const problems: string[] = [];
    for (const route of routes) problems.push(...(await auditRoute(page, route)));

    if (problems.length) {
      console.log(`\n=== ${vp.name} (${vp.width}px): ${problems.length} problem(s) over ${routes.length} routes ===`);
      for (const p of problems) console.log(`  ${p}`);
    } else {
      console.log(`\n=== ${vp.name} (${vp.width}px): ${routes.length} routes clean ===`);
    }
    await context.close();
    expect(problems).toEqual([]);
  });
}
