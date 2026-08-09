// Session — placeholder until Phase 7 wires real auth (mobile-number-first
// login, Argon2id, httpOnly cookies, rotation on privilege change).
//
// New User model (CLAUDE.md §5): direct `role AppRole` field, no userRoles
// join table. Permissions are derived from the role using PERMISSIONS registry.
//
// Phase 7 will add:
//   - createSession / destroySession / rotateSession
//   - password hashing (Argon2id)
//   - cookie plumbing via next/headers

import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "./context";
import type { PermissionKey } from "@/kernel/rbac/permissions";
import { PERMISSIONS } from "@/kernel/rbac/permissions";

export interface Session {
  readonly userId: string;
  readonly orgId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function allPermissions(): ReadonlySet<PermissionKey> {
  const s = new Set<PermissionKey>();
  for (const [mod, actions] of Object.entries(PERMISSIONS))
    for (const a of actions) s.add(`${mod}.${a}` as PermissionKey);
  return s;
}

export async function resolveContext(session: Session, opts?: { ip?: string }): Promise<RequestContext> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      id: true, organizationId: true, branchIds: true, role: true,
    },
  });

  const roles = [user.role as string];

  // OWNER sees all branches; all other roles are branch-filtered.
  const branchScope: RequestContext["branchScope"] =
    user.role === "OWNER" ? "ALL" : "MEMBERS";

  // Phase 7: derive permissions from role table. For now, OWNER gets all keys.
  const permissions: ReadonlySet<PermissionKey> = allPermissions();

  return {
    userId: user.id,
    orgId: user.organizationId,
    branchIds: user.branchIds,
    branchScope,
    roles,
    permissions,
    ip: opts?.ip,
  };
}
