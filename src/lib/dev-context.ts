// DEV-ONLY RequestContext helper. Until Phase 7 lands real auth (mobile-
// number-first login, Argon2id, httpOnly cookies), the app runs as the
// seeded organisation Owner so we can build modules against real data.
//
// Permission resolution mirrors session.ts:
//   1. If the OWNER user has a roleId, load RolePermission for that Role.
//      isOwnerRole=true → allPermissions().
//   2. Otherwise fall back to allPermissions() (during seed migration or
//      when the DB is unreachable).
//
// Deliberately placed OUTSIDE src/kernel/** because Rule 10 forbids
// automated changes to the kernel. This lives at the module boundary and
// is gated on NODE_ENV !== "production" — throws in prod so the bypass
// cannot escape into a deployment.

import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "@/kernel/auth/context";
import { PERMISSIONS, isPermissionKey, type PermissionKey } from "@/kernel/rbac/permissions";

let cached: RequestContext | undefined;

function allRegisteredPermissions(): ReadonlySet<PermissionKey> {
  const set = new Set<PermissionKey>();
  for (const [mod, actions] of Object.entries(PERMISSIONS)) {
    for (const a of actions) set.add(`${mod}.${a}` as PermissionKey);
  }
  return set;
}

const STUB_CONTEXT: RequestContext = {
  userId: "dev-stub-user",
  orgId: "dev-stub-org",
  branchIds: [],
  branchScope: "ALL",
  roles: ["OWNER"],
  permissions: allRegisteredPermissions(),
};

export async function devContext(): Promise<RequestContext> {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("devContext() called in production — refuse.");
  }
  if (cached) return cached;

  try {
    const user = await prisma.user.findFirstOrThrow({
      where: { role: "OWNER" },
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

    let permissions: ReadonlySet<PermissionKey>;

    if (user.dynamicRole) {
      if (user.dynamicRole.isOwnerRole) {
        permissions = allRegisteredPermissions();
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
      permissions = allRegisteredPermissions();
    }

    cached = {
      userId: user.id,
      orgId: user.organizationId,
      branchIds: user.branchIds,
      branchScope: "ALL",
      roles: [user.role as string],
      permissions,
    };
  } catch {
    console.warn("[devContext] DB unreachable — using stub context. Start Docker to load real data.");
    cached = STUB_CONTEXT;
  }

  return cached;
}
