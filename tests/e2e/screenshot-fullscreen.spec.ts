import { test } from "@playwright/test";
import path from "node:path";

const OUT = path.resolve(process.cwd());

test.use({ viewport: { width: 1920, height: 1080 } });

test.describe("fullscreen snapshots", () => {
  const routes: string[] = [
    "/",
    "/leads",
    "/clients",
    "/followups",
    `/leads/${process.env["E2E_LEAD_ID"] ?? ""}`,
    `/clients/${process.env["E2E_CLIENT_ID"] ?? ""}`,
  ];
  for (const route of routes) {
    test(`snap ${route}`, async ({ page }) => {
      if (route.endsWith("/")) { test.skip(); return; }
      await page.goto(route);
      await page.waitForLoadState("load");
      const name = route === "/" ? "root" : route.replace(/\//g, "_").replace(/[^a-z0-9_-]/gi, "");
      await page.screenshot({ path: path.join(OUT, `fs${name}.png`), fullPage: false });
    });
  }
});
