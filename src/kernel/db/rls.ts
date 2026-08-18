// §3.2 Row-Level Security plumbing.
//
// The migration 20260818000000_row_level_security enables FORCE RLS on every
// org-owned table with a deny-by-default policy keyed on the
// `app.current_org_id` GUC. This file is what sets that GUC.
//
// Prisma has no per-query connection hook, so we use the documented RLS
// pattern: batch `set_config(...)` and the query itself into one sequential
// `$transaction([...])`. Both statements then run on the SAME connection, which
// is what makes a transaction-local GUC visible to the query.
//
// Cost: one extra round trip per query. That is the price of a real second
// wall; the alternative (a session-level SET on a pooled connection) leaks the
// tenant across requests and is strictly worse.

import { Prisma } from "@prisma/client";
import { prisma } from "./client";

/**
 * Client extension that pins every query to `orgId` at the database level.
 * Composed into `scoped(ctx)` — see scoped.ts.
 */
export function rlsExtensionConfig(orgId: string) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: "rls-org-context",
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const [, result] = await prisma.$transaction([
              prisma.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`,
              query(args) as Prisma.PrismaPromise<unknown>,
            ]);
            return result;
          },
        },
      },
    }),
  );
}

/**
 * A raw (unscoped) Prisma client pinned to one tenant at the DATABASE level.
 *
 * For the handful of places that legitimately bypass `scoped(ctx)` — event
 * listeners, the audit writer, webhook handlers, admin importers — but still
 * operate inside a known organization. Without this they hit the
 * deny-by-default policy and silently see an empty database.
 *
 * This is NOT a substitute for `scoped(ctx)`: it applies no branch scoping and
 * writes no audit rows. Prefer `scoped(ctx)` in request-path module code.
 *
 * LIMITATION — raw queries: the extension hooks `$allModels`, so `$queryRaw`,
 * `$executeRaw` and friends are NOT model operations and bypass it entirely.
 * They run with no tenant set and therefore return nothing under RLS. For raw
 * SQL use `withTransaction(fn, { orgId })`, which sets the GUC on the
 * transaction's own connection.
 */
export function orgPrisma(orgId: string) {
  return prisma.$extends(rlsExtensionConfig(orgId));
}
