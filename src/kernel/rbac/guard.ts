// The permission guard. Called at the TOP of every server action and route
// handler. Rule 8 of the Twelve: permissions are checked server-side on every
// route — hiding a button is presentation, not authorisation.

import type { RequestContext } from "@/kernel/auth/context";
import type { PermissionKey } from "./permissions";

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  readonly permission: PermissionKey;

  constructor(permission: PermissionKey, message?: string) {
    super(
      message ??
        `Missing permission: ${permission}. Ask your administrator to grant it.`,
    );
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

/**
 * Throws ForbiddenError if ctx does not carry the given permission.
 * The union type on `permission` is enforced at compile time — a typo like
 * `invoice.creat` is a TS error, not a runtime miss.
 */
export function requirePermission(ctx: RequestContext, permission: PermissionKey): void {
  if (!ctx.permissions.has(permission)) {
    throw new ForbiddenError(permission);
  }
}

/**
 * Non-throwing variant. Prefer requirePermission on the server; use `can` for
 * conditional UI decisions on the server (never on the client — the payload
 * itself must not contain data the user cannot see, per Rule 8).
 */
export function can(ctx: RequestContext, permission: PermissionKey): boolean {
  return ctx.permissions.has(permission);
}
