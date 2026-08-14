import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  reactStrictMode: true,
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
      "./prisma/**/*",
    ],
  },
  // typedRoutes disabled — friction outweighs value while modules are still
  // landing in placeholder form. Re-enable in Session 20+ when routes stabilise.
  typedRoutes: false,
  turbopack: {
    root: path.resolve("."),
  },
};

export default config;
