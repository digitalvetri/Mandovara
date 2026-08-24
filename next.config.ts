import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@react-pdf/renderer", "canvas"],
  // Standalone output — copies just the files needed to run the server
  // into .next/standalone, so the production Docker image can be tiny
  // (no dev deps, no source, no unused node_modules). Required for
  // Coolify / any container deploy.
  output: "standalone",
  // Force the Prisma client + query engine binary into standalone
  // output. Next's static tracing misses these because they're loaded
  // via dynamic require from a pnpm hoist path that changes per env.
  // Without this, `.next/standalone` starts up and immediately crashes
  // with "Cannot find module '.prisma/client'".
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
      // bcryptjs is bundled into the server actions and never referenced
      // as a package at runtime by app code — but the entrypoint's seed
      // script requires it via node's resolver. Include it explicitly so
      // it lands in /app/node_modules/bcryptjs/ inside the standalone tree.
      "./node_modules/bcryptjs/**/*",
      "./prisma/**/*",
    ],
  },
  // typedRoutes disabled — friction outweighs value while modules are still
  // landing in placeholder form. Re-enable in Session 20+ when routes stabilise.
  typedRoutes: false,
  // TypeScript check runs in-container during `next build` — the 4 GB heap
  // set on the build stage in Dockerfile (`NODE_OPTIONS=--max-old-space-size=4096`)
  // is enough to avoid the OOM that previously forced us to skip it.
  turbopack: {
    root: path.resolve("."),
  },
  // Server actions default to a 1 MB request body — that's a hard block on
  // catalogue PDF uploads (typical brand catalogues are 5–100 MB). The
  // uploadCollectionPdf action itself refuses anything over 200 MB, so
  // 210 MB here matches with a small margin for multipart overhead.
  experimental: {
    serverActions: {
      bodySizeLimit: "210mb",
    },
  },
};

// Sentry build-time wrapper. Source-map upload only runs when
// SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT are all set (Coolify
// build env). Without them, withSentryConfig no-ops and next build proceeds
// unchanged. Runtime Sentry init lives in src/instrumentation{,-client}.ts.
const sentryEnabled = !!(
  process.env["SENTRY_AUTH_TOKEN"]
  && process.env["SENTRY_ORG"]
  && process.env["SENTRY_PROJECT"]
);

export default sentryEnabled
  ? withSentryConfig(config, {
      org:       process.env["SENTRY_ORG"]!,
      project:   process.env["SENTRY_PROJECT"]!,
      authToken: process.env["SENTRY_AUTH_TOKEN"]!,
      silent:            true,
      widenClientFileUpload: true,
      disableLogger:     true,
      tunnelRoute:       "/monitoring",
    })
  : config;
