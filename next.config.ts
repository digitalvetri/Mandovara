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
  turbopack: {
    root: path.resolve("."),
  },
};

export default config;
