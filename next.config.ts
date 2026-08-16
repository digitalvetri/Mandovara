import type { NextConfig } from "next";
import path from "node:path";

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
  // Skip in-container TypeScript check — Coolify's build container OOMs
  // on it (small VPS + 658 packages + tsc + Turbopack). Local `pnpm build`
  // + `pnpm exec tsc` still catch every type error, so this only removes
  // the deploy-time check, not our source-of-truth check.
  typescript: {
    ignoreBuildErrors: true,
  },
  // Same reasoning for lint — expensive at build time, redundant with
  // local pnpm exec eslint. Not a quality gate we lose, just moved out
  // of the deploy path.
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: path.resolve("."),
  },
};

export default config;
