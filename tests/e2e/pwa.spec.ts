// PWA installability + offline shell.
//
// Chrome's install criteria: served over a secure origin, a linked manifest
// with name/short_name, start_url, display standalone, a 192px and a 512px
// icon, AND a registered service worker with a fetch handler. Every one of
// those was missing or wrong before: the manifest was scoped to /m/, was
// linked only from the mobile layout, declared icon sizes that did not match
// the actual 293x224 file, and there was no service worker at all.

import { test, expect } from "@playwright/test";

test.describe("PWA", () => {
  test("manifest is linked on the office surface and is valid", async ({ page }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href, "no <link rel=manifest> — the app cannot be installed").toBeTruthy();

    const res = await page.request.get(href!);
    expect(res.ok()).toBe(true);
    const m = await res.json();

    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");   // whole app, not just /m/

    const sizes = (m.icons ?? []).map((i: { sizes: string }) => i.sizes);
    expect(sizes, "Chrome requires a 192px icon").toContain("192x192");
    expect(sizes, "Chrome requires a 512px icon").toContain("512x512");
    expect(
      (m.icons ?? []).some((i: { purpose?: string }) => i.purpose?.includes("maskable")),
      "a maskable icon keeps Android from clipping the mark",
    ).toBe(true);
  });

  test("declared icons exist and are actually the declared size", async ({ page }) => {
    const res = await page.request.get("/manifest.webmanifest");
    const m = await res.json();
    for (const icon of m.icons) {
      const r = await page.request.get(icon.src);
      expect(r.ok(), `${icon.src} is missing`).toBe(true);
      const buf = await r.body();
      // PNG header: width/height are big-endian uint32 at bytes 16..24.
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      const [dw, dh] = icon.sizes.split("x").map(Number);
      expect(`${w}x${h}`, `${icon.src} declares ${icon.sizes} but is ${w}x${h}`).toBe(`${dw}x${dh}`);
    }
  });

  test("service worker registers and controls the page", async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return "unsupported";
      // Registration is deferred to window "load", so poll briefly.
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then(() => "ready"),
        new Promise((r) => setTimeout(() => r("timeout"), 15000)),
      ]);
      return ready as string;
    });
    expect(state, "no service worker means no install prompt").toBe("ready");
  });

  test("offline fallback page renders and reassures about queued work", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /you\u2019re offline/i })).toBeVisible();
    await expect(page.getByText(/will sync by itself/i)).toBeVisible();
  });

  test("viewport allows pinch-zoom (accessibility floor, §6.3.11)", async ({ page }) => {
    await page.goto("/");
    const content = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(content).toContain("width=device-width");
    expect(content, "zoom must not be disabled").not.toContain("user-scalable=no");
  });
});
