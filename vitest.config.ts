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
      // Only compute coverage against the two kernels the KIT gate enforces.
      include: ["src/kernel/money/**/*.ts", "src/kernel/tax/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
      // Gate: 100 % branch coverage on money and tax (Session 5 KIT).
      thresholds: {
        "src/kernel/money/**": { branches: 100, functions: 100, lines: 100, statements: 100 },
        "src/kernel/tax/**":   { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
