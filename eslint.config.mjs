// Flat config, ESLint 9. Five custom rules that FAIL the build:
//   (a) `any`                                     — @typescript-eslint/no-explicit-any
//   (b) console.log                                — no-console
//   (c) .toLocaleString('en-US')                   — no-restricted-syntax
//   (d) `@prisma/client` imports outside kernel/db — no-restricted-imports (global) + overrides
//   (e) file > 300 lines                           — max-lines (CLAUDE.md §10)
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

// Importing the RAW client outside src/kernel/db silently defeats §3.2: the
// request-path connection has no `app.current_org_id` set, so every query hits
// the deny-by-default RLS policy and the page renders empty with no error.
// Five modules (make, install x2, leads, the installer PWA) were doing exactly
// this via `import { prisma as db }` and returned zero rows once RLS landed.
const bannedRawClientImport = {
  name: "@/kernel/db/client",
  importNames: ["prisma", "authBootstrapPrisma"],
  message:
    "Do not use the raw Prisma client outside src/kernel/db. Use scoped(ctx) " +
    "for request-path work, or orgPrisma(ctx.orgId) when you must bypass " +
    "scoping but still need the tenant pinned for Row-Level Security. " +
    "authBootstrapPrisma is reserved for authentication lookups.",
};

const bannedPrismaImport = {
  name: "@prisma/client",
  message:
    "Rule 1 & 10: import Prisma only through src/kernel/db. Use `import { db } from '@/kernel/db/scoped'`.",
  allowTypeImports: true,
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

      // Allow _-prefixed identifiers to be declared but unused (stub params, interface stubs)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],

      // Custom rule (b): no console.log — Rule 11 of the Twelve
      // (console.warn / console.error remain allowed for genuine errors)
      "no-console": ["error", { allow: ["warn", "error"] }],

      // Custom rule (c): no toLocaleString('en-US') — UI rule 2, docs/BUILD-SPEC.md §5.6
      "no-restricted-syntax": ["error", bannedUSLocaleSyntax],

      // Custom rule (d): no direct @prisma/client imports outside src/kernel/db — Rule 1
      "no-restricted-imports": ["error", { paths: [bannedPrismaImport, bannedRawClientImport] }],

      // Custom rule (e): no file over 300 lines — CLAUDE.md §10
      "max-lines": ["error", 300],
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
  // max-lines is off — a thorough test suite for a single module can legitimately
  // be longer than 300 lines without being poorly structured.
  {
    files: ["tests/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": "off",
      "max-lines": "off",
    },
  },

  // Seed & scripts: same, they need stdout and direct Prisma access.
  // max-lines is off — seed files are inherently long data-generation scripts.
  {
    files: ["prisma/seed.ts", "prisma/seed/**/*.{ts,mjs,js}", "scripts/**/*.{ts,mjs,js}"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": "off",
      "max-lines": "off",
    },
  },

  // Module code may not import @prisma/client directly (§10 boundary rule) and
  // may not use @ts-nocheck. The blanket "phase-parked" override that used to
  // sit here disabled no-restricted-imports, no-explicit-any, max-lines AND
  // ban-ts-comment across ~20 module directories — i.e. most of the app — so
  // the boundary rule the spec calls for was effectively unenforced, and
  // @ts-nocheck on 7 files (1,692 LOC) hid real bugs: a non-existent
  // `snagItem` model, `Project.status` (the column is `stage`),
  // `Client.primaryMobile` (it is `mobile`), a `lead.stageChanged` event that
  // is not in the union, a "VERIFIED" snag status absent from the enum, and
  // two creates missing organizationId. All are fixed; the override is gone.
  //
  // Only tests/kernel keeps the relaxed prisma-import rule, because test
  // fixtures legitimately construct cross-tenant data.
  {
    files: ["tests/kernel/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
      "max-lines": "off",
    },
  },

  // The auth bootstrap is the one place that legitimately needs the raw owner
  // connection: resolving a login credential or a session cookie to a User row
  // has to happen BEFORE the tenant is known, so it cannot run under RLS.
  // Keep this list short — every entry is a hole in §3.2.
  {
    files: [
      "src/lib/dev-auth.ts",
      "src/lib/dev-context.ts",
      "src/app/api/webhooks/whatsapp/route.ts",   // resolves the tenant from the WABA payload
      "src/app/api/admin/import-stock/route.ts",  // single-tenant admin importer
      "src/app/api/admin/bootstrap/route.ts",     // one-time org bootstrap — runs before any tenant exists
      "src/app/api/admin/test-user/route.ts",     // create / delete disposable OWNER for QA
      "src/modules/quotations/public-query.ts",   // token IS the credential — no org context exists
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  // The service worker runs in a ServiceWorkerGlobalScope, not a browser
  // window — `self`, `caches`, `clients`, `Response` and `fetch` are its
  // globals. It is plain JS shipped from public/, not part of the TS build.
  {
    files: ["public/sw.js"],
    languageOptions: {
      globals: {
        self: "readonly",
        caches: "readonly",
        clients: "readonly",
        fetch: "readonly",
        Response: "readonly",
        URL: "readonly",
        Promise: "readonly",
      },
    },
  },

  // Prettier last — disable rules that would conflict with formatting
  prettier,
);
