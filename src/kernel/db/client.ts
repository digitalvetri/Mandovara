// Prisma singleton. The ONE place that instantiates PrismaClient.
// Everything else in the codebase reaches the DB through db.scoped(ctx),
// which extends this singleton with tenant + branch scoping + audit.

import { PrismaClient } from "@prisma/client";

declare global {

  var __prisma__: PrismaClient | undefined;
}

/** Reuse the same client across HMR reloads in development. */
export const prisma: PrismaClient =
  globalThis.__prisma__ ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma__ = prisma;
}

export type {
  AppRole, InstallStatus, MakeJobStatus, HeadingType, RequestStatus,
} from "@prisma/client";
