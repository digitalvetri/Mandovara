import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Kernel and future concurrency tests share one Postgres — run files serially.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Calc engine added in Phase 8 — 100% branch coverage is a Phase 8 gate (§12.1).
      include: [
        "src/kernel/money/**/*.ts",
        "src/kernel/tax/**/*.ts",
        "src/kernel/calc/**/*.ts",
        "src/kernel/einvoice/**/*.ts",
      ],
      exclude: ["**/*.test.ts", "**/index.ts"],
      thresholds: {
        "src/kernel/money/**": { branches: 100, functions: 100, lines: 100, statements: 100 },
        "src/kernel/tax/**":   { branches: 100, functions: 100, lines: 100, statements: 100 },
        "src/kernel/calc/**":  { branches: 100, functions: 100, lines: 100, statements: 100 },
        // e-invoicing moves money into a government portal — §12.1 treats
        // financial logic as blocking.
        "src/kernel/einvoice/**": { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
