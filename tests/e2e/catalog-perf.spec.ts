// §12.1 Phase 1 gate — Catalog search p95 < 200ms across 3,500 colourways.
//
// REQUIRES PRODUCTION BUILD: Next.js dev mode adds ~150–200ms JIT overhead per
// request, which makes the 200ms p95 gate unreachable. This test is gated on
// E2E_PERF=1 so it only runs when the caller explicitly signals a production
// environment (e.g. `pnpm build && pnpm start`, then set E2E_PERF=1).
//
// To run: E2E_PERF=1 npx playwright test tests/e2e/catalog-perf.spec.ts
//         (with the production server already running on :3000 and full seed data)
//
// The §12.1 gate evidence output is printed even when the test passes so it can
// be pasted into the phase verification document.
//
// Dev-mode numbers for reference (CI baseline, not the gate):
//   p50 ~220ms · p95 ~375ms · with seeded DB but JIT compilation overhead.

import { test, expect } from "@playwright/test";

const IS_PERF_RUN = !!process.env["E2E_PERF"];

const QUERIES = [
  "silk", "grey", "3M", "sheer", "plain", "grass", "print",
  "stripe", "velvet", "cotton", "linen", "blue", "pattern",
  "solid", "floral", "woven", "curtain", "roller", "zebra", "film",
];

test("catalog search p95 < 200ms (Phase 1 gate)", async ({ request }) => {
  test.skip(
    !IS_PERF_RUN,
    "Catalog perf gate requires production build. " +
    "Set E2E_PERF=1 and run against `pnpm start` with the full seed data loaded.",
  );

  const times: number[] = [];
  const N = QUERIES.length; // 20 samples

  for (let i = 0; i < N; i++) {
    const q     = QUERIES[i] ?? "";
    const start = Date.now();
    const res   = await request.get(`/products?q=${encodeURIComponent(q)}`);
    const ms    = Date.now() - start;

    // Verify the page returned successfully (not 500/404)
    expect(res.status(), `${q} returned ${res.status()}`).toBe(200);
    times.push(ms);
  }

  times.sort((a, b) => a - b);

  const p50 = times[Math.floor(N * 0.50)]!;
  const p95 = times[Math.floor(N * 0.95)]!;
  const max = times[N - 1]!;

  // Always print — the gate requires pasting this output (§12.1)
  console.log(`\nCatalog search benchmark (N=${N})`);
  console.log(`  p50: ${p50}ms  p95: ${p95}ms  max: ${max}ms`);
  console.log(`  Raw: [${times.join(", ")}]`);

  expect(p95, `p95 ${p95}ms exceeds 200ms gate`).toBeLessThan(200);
});
