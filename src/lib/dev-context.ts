// DEV-ONLY RequestContext helper. Until Phase 7 lands real auth (mobile-
// number-first login, Argon2id, httpOnly cookies), the app uses a cookie
// "dev_uid" set by the dev login page to identity the current user.
//
// Uses React's cache() for per-request deduplication — multiple server
// components/actions calling devContext() in one request share one DB read.
// Unlike a module-level variable, this is per-request, so different browser
// sessions get different contexts.

import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "@/kernel/auth/context";
import { PERMISSIONS, isPermissionKey, type PermissionKey } from "@/kernel/rbac/permissions";

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

async function buildContext(userId: string): Promise<RequestContext | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    if (!user) return null;

    let permissions: ReadonlySet<PermissionKey>;
    if (user.dynamicRole) {
      if (user.dynamicRole.isOwnerRole) {
        permissions = allRegisteredPermissions();
      } else {
        const s = new Set<PermissionKey>();
        for (const p of user.dynamicRole.permissions) {
          if (p.scope !== "NONE" && isPermissionKey(p.key)) s.add(p.key);
        }
        permissions = s;
      }
    } else {
      permissions = allRegisteredPermissions();
    }

    return {
      userId: user.id,
      orgId: user.organizationId,
      branchIds: user.branchIds,
      branchScope: "ALL",
      roles: [user.role as string],
      permissions,
    };
  } catch {
    return null;
  }
}

export const devContext = cache(async (): Promise<RequestContext> => {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("devContext() called in production — refuse.");
  }

  // 1. Try the dev_uid cookie (set by the login page)
  try {
    const jar = await cookies();
    const uid = jar.get("dev_uid")?.value;
    if (uid) {
      const ctx = await buildContext(uid);
      if (ctx) return ctx;
    }
  } catch {
    // Running outside request scope (seed scripts, tests) — fall through
  }

  // 2. Fall back to the first OWNER in the DB
  try {
    const owner = await prisma.user.findFirstOrThrow({
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
    const ctx = await buildContext(owner.id);
    if (ctx) return ctx;
  } catch {
    console.warn("[devContext] DB unreachable — using stub context. Start Docker to load real data.");
  }

  return STUB_CONTEXT;
});
