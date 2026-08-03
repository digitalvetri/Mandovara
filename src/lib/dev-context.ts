// DEV-ONLY RequestContext helper. Until Session 7 lands real auth (mobile-
// number-first login, Argon2id, httpOnly cookies), the app runs as the
// seeded organisation Owner so we can build modules against real data.
//
// Deliberately placed OUTSIDE src/kernel/** because Rule 10 forbids
// automated changes to the kernel. This lives at the module boundary and
// is gated on NODE_ENV !== "production" — throws in prod so the bypass
// cannot escape into a deployment.

import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "@/kernel/auth/context";
import { PERMISSIONS, type PermissionKey } from "@/kernel/rbac/permissions";

let cached: RequestContext | undefined;

// Every permission in the registry — dev context runs as an all-powerful
// owner because the seed only records a sample subset of keys in RolePermission.
// Session 7 replaces this with role-derived permissions from the DB.
function allRegisteredPermissions(): ReadonlySet<PermissionKey> {
  const set = new Set<PermissionKey>();
  for (const [mod, actions] of Object.entries(PERMISSIONS)) {
    for (const a of actions) set.add(`${mod}.${a}` as PermissionKey);
  }
  return set;
}

export async function devContext(): Promise<RequestContext> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("devContext() called in production — refuse.");
  }
  if (cached) return cached;

  const user = await prisma.user.findFirstOrThrow({
    where: { email: "owner@mandovara.example" },
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

  const roles = user.userRoles.map((ur) => ur.role.name);

  cached = {
    userId: user.id,
    orgId: user.orgId,
    branchIds: user.branchIds,
    branchScope: "ALL",
    roles,
    permissions: allRegisteredPermissions(),
  };
  return cached;
}
