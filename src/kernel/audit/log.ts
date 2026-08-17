// Audit extension. Rule #4: every mutation writes an audit row — no exceptions,
// including bulk operations.
//
// This is a Prisma client extension that piggybacks on the same $allOperations
// hook as db.scoped(). It's exposed here separately so scoped.ts can compose
// them (see scoped.ts for the wired-together `scopedWithAudit(ctx)`).
//
// Design decisions worth reviewing by hand (Rule #10):
//   - AUDIT_EXEMPT covers AuditLog (recursion) and StockLedgerEntry
//     (already immutable, and its refType/refId is its own audit trail).
//   - Single-row update/delete/upsert: we capture `before` via a findFirst on
//     the raw prisma client — scoped's orgId filter is added explicitly so
//     we do not leak across tenants during the peek.
//   - Bulk ops (createMany, updateMany, deleteMany): we write ONE summary
//     audit row with { count, where }. Per-row would be prohibitively
//     expensive on imports; the criteria + count is enough to reconstruct.
//   - The audit write uses raw prisma (bypasses scope) but supplies orgId
//     from ctx — deliberate: we don't want to re-enter the audit extension.

import type { Prisma } from "@prisma/client";
import type { RequestContext } from "@/kernel/auth/context";
import { orgPrisma } from "@/kernel/db/rls";
import { AUDIT_EXEMPT } from "@/kernel/db/scoping-map";

const MUTATIONS = new Set<string>([
  "create", "createMany", "createManyAndReturn",
  "update", "updateMany",
  "upsert",
  "delete", "deleteMany",
]);

const BULK = new Set<string>(["createMany", "createManyAndReturn", "updateMany", "deleteMany"]);
const READ_BEFORE = new Set<string>(["update", "delete", "upsert"]);

function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function extractId(result: unknown): string {
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === "string") return id;
  }
  return "(unknown)";
}

/**
 * Extension config. Applied on TOP of scoped so it sees scope-injected args.
 * Kept as a config object (not an already-built extension) so the caller can
 * chain: prisma.$extends(scopeExt).$extends(auditExt).
 */
export function auditExtensionConfig(ctx: RequestContext) {
  return {
    name: "mandovara-audit",
    query: {
      $allModels: {
        async $allOperations({
          model, operation, args, query,
        }: {
          model: string;
          operation: string;
          args: unknown;
          query: (args: unknown) => Promise<unknown>;
        }) {
          if (AUDIT_EXEMPT.has(model) || !MUTATIONS.has(operation)) {
            return query(args);
          }

          const argsAny = args as { where?: Record<string, unknown>; data?: unknown };
          const isBulk = BULK.has(operation);

          // Peek `before` for single-row updates/deletes/upserts
          let before: unknown = null;
          if (READ_BEFORE.has(operation) && !isBulk && argsAny.where != null) {
            try {
              const delegate = (orgPrisma(ctx.orgId) as unknown as Record<string, {
                findFirst: (a: { where?: unknown }) => Promise<unknown>;
              }>)[delegateName(model)];
              if (delegate?.findFirst) {
                before = await delegate.findFirst({
                  where: { ...argsAny.where, organizationId: ctx.orgId },
                });
              }
            } catch {
              // best-effort peek; missing before is not fatal
            }
          }

          const result = await query(args);

          const entityId = isBulk ? "(bulk)" : extractId(result);
          const after: unknown = isBulk
            ? {
                count: (result as { count?: number } | null)?.count
                     ?? (Array.isArray(result) ? result.length : 0),
                where: argsAny.where ?? null,
              }
            : result;

          await orgPrisma(ctx.orgId).auditLog.create({
            data: {
              organizationId: ctx.orgId,
              actorId: ctx.userId,
              entityType: model,
              entityId,
              action: operation.toUpperCase(),
              before: before as Prisma.InputJsonValue,
              after: after as Prisma.InputJsonValue,
              ip: ctx.ip ?? null,
            },
          });

          return result;
        },
      },
    },
  };
}
