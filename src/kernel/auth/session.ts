// Session — placeholder until Session 7 wires real auth (mobile-number-first
// login, Argon2id, httpOnly cookies, rotation on privilege change).
//
// For now, this file exports:
//   - a Session type (what we plan to store in the cookie payload)
//   - resolveContext(session) — turns a session into a RequestContext by
//     loading the user's roles + permissions from the DB.
//
// Session 7 will add:
//   - createSession / destroySession / rotateSession
//   - password hashing (Argon2id)
//   - cookie plumbing via next/headers
//
// This file uses the raw prisma singleton because it IS the auth boundary —
// we cannot use db.scoped(ctx) here since there is no ctx yet.

import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "./context";
import type { PermissionKey } from "@/kernel/rbac/permissions";

export interface Session {
  readonly userId: string;
  readonly orgId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

export async function resolveContext(session: Session, opts?: { ip?: string }): Promise<RequestContext> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: {
      id: true, orgId: true, branchIds: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: { select: { key: true, scope: true } },
            },
          },
        },
      },
    },
  });

  const permissions = new Set<PermissionKey>();
  const roles: string[] = [];
  for (const ur of user.userRoles) {
    roles.push(ur.role.name);
    for (const p of ur.role.permissions) {
      if (p.scope !== "NONE") {
        permissions.add(p.key as PermissionKey);
      }
    }
  }

  // Owner and Manager see every branch by convention.
  const branchScope: RequestContext["branchScope"] =
    roles.includes("Owner") || roles.includes("Manager") ? "ALL" : "MEMBERS";

  return {
    userId: user.id,
    orgId: user.orgId,
    branchIds: user.branchIds,
    branchScope,
    roles,
    permissions,
    ip: opts?.ip,
  };
}
