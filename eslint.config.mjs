// Flat config, ESLint 9. Four custom rules that FAIL the build:
//   (a) `any`                                     — @typescript-eslint/no-explicit-any
//   (b) console.log                                — no-console
//   (c) .toLocaleString('en-US')                   — no-restricted-syntax
//   (d) `@prisma/client` imports outside kernel/db — no-restricted-imports (global) + overrides
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

const bannedPrismaImport = {
  name: "@prisma/client",
  message:
    "Rule 1 & 10: import Prisma only through src/kernel/db. Use `import { db } from '@/kernel/db/scoped'`.",
};

const bannedUSLocaleSyntax = {
  selector:
    "CallExpression[callee.property.name='toLocaleString'][arguments.0.type='Literal'][arguments.0.value='en-US']",
  message:
    "Indian formatting only. Use formatINR() from @/kernel/money/format. toLocaleString('en-US') is banned.",
};

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "prisma/migrations/**",
      "install*.log",
      "dev.log",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Project-wide rules
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        // Node globals for config files, scripts and tests
        process: "readonly",
        console: "readonly",
        globalThis: "readonly",
      },
    },
    rules: {
      // Custom rule (a): no `any` — Rule 11 of the Twelve
      "@typescript-eslint/no-explicit-any": "error",

      // Custom rule (b): no console.log — Rule 11 of the Twelve
      // (console.warn / console.error remain allowed for genuine errors)
      "no-console": ["error", { allow: ["warn", "error"] }],

      // Custom rule (c): no toLocaleString('en-US') — UI rule 2, docs/BUILD-SPEC.md §5.6
      "no-restricted-syntax": ["error", bannedUSLocaleSyntax],

      // Custom rule (d): no direct @prisma/client imports outside src/kernel/db — Rule 1
      "no-restricted-imports": ["error", { paths: [bannedPrismaImport] }],
    },
  },

  // Allow @prisma/client throughout the kernel — this is where scoping is
  // defined. Module code (src/modules/**) must still go through db.scoped(ctx).
  {
    files: ["src/kernel/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // Test files: relax console + prisma import rules so tests can set up their DB.
  {
    files: ["tests/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": "off",
    },
  },

  // Seed & scripts: same, they need stdout and direct Prisma access
  {
    files: ["prisma/seed.ts", "prisma/seed/**/*.{ts,mjs,js}", "scripts/**/*.{ts,mjs,js}"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": "off",
    },
  },

  // Prettier last — disable rules that would conflict with formatting
  prettier,
);
