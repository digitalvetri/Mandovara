// Session — placeholder until Phase 7 wires real auth (mobile-number-first
// login, Argon2id, httpOnly cookies, rotation on privilege change).
//
// Permission resolution:
//   1. If User.roleId is set, load RolePermission rows for that Role.
//      isOwnerRole=true → allPermissions(); otherwise the explicit key set.
//   2. If User.roleId is null (legacy / not yet backfilled), fall back to
//      allPermissions() so no one loses access during migration.
//
// Phase 7 will add:
//   - createSession / destroySession / rotateSession
//   - password hashing (Argon2id)
//   - cookie plumbing via next/headers

import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "./context";
import type { PermissionKey } from "@/kernel/rbac/permissions";
import { PERMISSIONS, isPermissionKey } from "@/kernel/rbac/permissions";

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
      dynamicRole: {
        select: {
          isOwnerRole: true,
          permissions: { select: { key: true, scope: true } },
        },
      },
    },
  });

  const roles = [user.role as string];

  // OWNER sees all branches; other roles are branch-filtered.
  const branchScope: RequestContext["branchScope"] =
    user.role === "OWNER" ? "ALL" : "MEMBERS";

  let permissions: ReadonlySet<PermissionKey>;

  if (user.dynamicRole) {
    if (user.dynamicRole.isOwnerRole) {
      permissions = allPermissions();
    } else {
      const s = new Set<PermissionKey>();
      for (const p of user.dynamicRole.permissions) {
        if (p.scope !== "NONE" && isPermissionKey(p.key)) {
          s.add(p.key);
        }
      }
      permissions = s;
    }
  } else {
    // Legacy fallback: dynamicRole not assigned yet — grant all during transition
    permissions = allPermissions();
  }

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
