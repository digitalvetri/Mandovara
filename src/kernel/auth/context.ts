// RequestContext — the identity carried through every request.
// Resolved once per request from the session (Session 7) and passed to
// db.scoped(ctx) + requirePermission(ctx, ...).
//
// This is the single source of truth for "who is calling and what may they see".
// Every server action, route handler and job runner receives one of these.

import type { PermissionKey } from "@/kernel/rbac/permissions";

export type BranchScope = "ALL" | "MEMBERS";

export interface RequestContext {
  readonly userId: string;
  readonly orgId: string;
  /** Branches the user is authorised to see. Empty means only-own-branch or all-branches, decided by branchScope. */
  readonly branchIds: readonly string[];
  /** ALL = user sees every branch in the org (owner/manager). MEMBERS = restricted to branchIds. */
  readonly branchScope: BranchScope;
  readonly roles: readonly string[];
  /** Resolved permission set — a plain Set for O(1) lookups in the guard. */
  readonly permissions: ReadonlySet<PermissionKey>;
  /** IP for the audit log. Optional — omitted when the caller is a job runner. */
  readonly ip?: string;
}

/**
 * Convenience: is this context authorised to read a row that belongs to `branchId`?
 * Used by module code when filtering derived data that isn't directly queried
 * through db.scoped (e.g. materialised aggregates).
 */
export function canSeeBranch(ctx: RequestContext, branchId: string): boolean {
  if (ctx.branchScope === "ALL") return true;
  return ctx.branchIds.includes(branchId);
}
