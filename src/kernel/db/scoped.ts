// db.scoped(ctx) — the ONLY database entry point for tenant-scoped work.
//
// Twelve Rules #1: "Tenant and branch scope is applied in the repository
// layer only. No raw prisma.* calls in routes, actions or components.
// Everything goes through db.scoped(ctx). Postgres RLS is a second wall,
// never the only one."
//
// Rule #10: this file is human-reviewed. Do not run codemods on it.
//
// What this extension does, per operation family:
//
//   READ + WHERE-BASED (findFirst/OrThrow, findMany, count, aggregate,
//     groupBy, update, updateMany, delete, deleteMany):
//     - injects  {orgId: ctx.orgId}         into args.where
//     - injects  {branchId: {in: ctx.branchIds}} when the model is
//       branch-scoped AND ctx.branchScope === 'MEMBERS'
//
//   CREATE (create, createMany, createManyAndReturn):
//     - injects  {orgId: ctx.orgId}         into args.data (or each row)
//     - validates any caller-supplied branchId against ctx.branchIds when
//       branch-scoped + MEMBERS scope
//
//   UPSERT:
//     - inject scope into where + create; leaves update untouched
//
//   FIND UNIQUE (findUnique, findUniqueOrThrow):
//     - performs the query as given (Prisma refuses extra fields on the
//       unique where), then POST-FILTERS the result by orgId.
//     - findUniqueOrThrow throws if the row exists but belongs to another
//       tenant — matching the "does not exist for you" contract.

import { Prisma } from "@prisma/client";
import type { RequestContext } from "@/kernel/auth/context";
import { auditExtensionConfig } from "@/kernel/audit/log";
import { prisma } from "./client";
import { BRANCH_SCOPED, TENANT_SCOPED } from "./scoping-map";

export class CrossTenantWriteError extends Error {
  constructor(model: string, field: string, given: unknown, expected: unknown) {
    super(
      `Refused to write ${model}.${field}=${String(given)} — ctx allows ${JSON.stringify(expected)}. ` +
        `This is a scoping violation; check the caller.`,
    );
    this.name = "CrossTenantWriteError";
  }
}

export function scoped(ctx: RequestContext) {
  return prisma.$extends(scopeExtensionConfig(ctx)).$extends(auditExtensionConfig(ctx));
}

/** Scope-only extension. Exported for tests that want to observe scoping in
 *  isolation from the audit path. */
export function scopedNoAudit(ctx: RequestContext) {
  return prisma.$extends(scopeExtensionConfig(ctx));
}

interface OpCallbackArgs {
  model: string;
  operation: string;
  args: { where?: Record<string, unknown>; data?: unknown; create?: unknown; update?: unknown };
  query: (a: unknown) => Promise<unknown>;
}

function scopeExtensionConfig(ctx: RequestContext) {
  return {
    name: "mandovara-scoped",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: OpCallbackArgs) {
          if (!TENANT_SCOPED.has(model)) {
            return query(args);
          }
          const isBranch = BRANCH_SCOPED.has(model);
          const branchFilter =
            isBranch && ctx.branchScope === "MEMBERS"
              ? { branchId: { in: [...ctx.branchIds] } }
              : {};

          switch (operation) {
            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "count":
            case "aggregate":
            case "groupBy":
              return query(withWhere(args, ctx.orgId, branchFilter));

            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany":
              return query(withWhere(args, ctx.orgId, branchFilter));

            case "create":
              validateBranch(model, args.data, ctx, isBranch);
              return query(withData(args as HasData<Record<string, unknown>>, ctx.orgId));

            case "createMany":
            case "createManyAndReturn": {
              const rows = Array.isArray(args.data)
                ? (args.data as Record<string, unknown>[])
                : [args.data as Record<string, unknown>];
              for (const r of rows) validateBranch(model, r, ctx, isBranch);
              return query({ ...args, data: rows.map((r) => ({ ...r, orgId: ctx.orgId })) });
            }

            case "upsert": {
              validateBranch(model, args.create, ctx, isBranch);
              return query({
                ...args,
                where: { ...(args.where ?? {}), orgId: ctx.orgId, ...branchFilter },
                create: { ...(args.create as Record<string, unknown> ?? {}), orgId: ctx.orgId },
              });
            }

            case "findUnique":
            case "findUniqueOrThrow": {
              const raw = await query(args);
              if (raw == null) return raw;
              const row = raw as { orgId?: string; branchId?: string };
              if (row.orgId != null && row.orgId !== ctx.orgId) {
                if (operation === "findUniqueOrThrow") {
                  throw new Prisma.PrismaClientKnownRequestError(
                    `No ${model} found`, { code: "P2025", clientVersion: "scoped" },
                  );
                }
                return null;
              }
              if (isBranch && ctx.branchScope === "MEMBERS" && row.branchId != null) {
                if (!ctx.branchIds.includes(row.branchId)) {
                  if (operation === "findUniqueOrThrow") {
                    throw new Prisma.PrismaClientKnownRequestError(
                      `No ${model} found`, { code: "P2025", clientVersion: "scoped" },
                    );
                  }
                  return null;
                }
              }
              return raw;
            }

            default:
              return query(args);
          }
        },
      },
    },
  };
}

// ── helpers ──────────────────────────────────────────────────────

interface HasWhere {
  where?: Record<string, unknown>;
}

function withWhere<T extends HasWhere>(
  args: T,
  orgId: string,
  branchFilter: Record<string, unknown>,
): T {
  return { ...args, where: { ...(args.where ?? {}), orgId, ...branchFilter } };
}

interface HasData<D> {
  data?: D;
}

function withData<D extends Record<string, unknown>>(
  args: HasData<D>,
  orgId: string,
): HasData<D & { orgId: string }> {
  return { ...args, data: { ...(args.data ?? {} as D), orgId } };
}

function validateBranch(
  model: string,
  data: unknown,
  ctx: RequestContext,
  isBranch: boolean,
): void {
  if (!isBranch || ctx.branchScope === "ALL") return;
  const row = data as { branchId?: string } | undefined;
  const given = row?.branchId;
  if (given != null && !ctx.branchIds.includes(given)) {
    throw new CrossTenantWriteError(model, "branchId", given, ctx.branchIds);
  }
}

/**
 * The type returned by scoped(ctx). Modules should type their query helpers
 * against this rather than importing the raw PrismaClient.
 */
export type ScopedClient = ReturnType<typeof scoped>;
