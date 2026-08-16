// Per-request RequestContext resolver — reads the signed session cookie,
// verifies its HMAC, and hydrates the user's org/roles/permissions.
//
// Uses React's cache() for per-request deduplication.
//
// In production: no cookie = throw. The middleware (src/proxy.ts) prevents
// unauthenticated requests from ever reaching a page/action that calls this,
// so a throw here indicates a bug (or an api route missing from the public
// prefixes). In dev, if you hit a page without logging in you'll see the
// error at the layout boundary — go to /login and sign in.

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "@/kernel/auth/context";
import { PERMISSIONS, isPermissionKey, type PermissionKey } from "@/kernel/rbac/permissions";
import { SESSION_COOKIE, verifySession } from "./session";

function allRegisteredPermissions(): ReadonlySet<PermissionKey> {
  const set = new Set<PermissionKey>();
  for (const [mod, actions] of Object.entries(PERMISSIONS)) {
    for (const a of actions) set.add(`${mod}.${a}` as PermissionKey);
  }
  return set;
}

async function buildContext(userId: string): Promise<RequestContext | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, organizationId: true, branchIds: true, role: true, status: true,
        dynamicRole: {
          select: {
            isOwnerRole: true,
            permissions: { select: { key: true, scope: true } },
          },
        },
      },
    });
    if (!user) return null;
    if (user.status !== "ACTIVE") return null;

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
  let uid: string | null = null;
  try {
    const jar = await cookies();
    const raw = jar.get(SESSION_COOKIE)?.value;
    uid = await verifySession(raw);
  } catch {
    // Running outside a request scope (seed scripts, tests) — leave uid null.
  }

  if (uid) {
    const ctx = await buildContext(uid);
    if (ctx) return ctx;
    // Cookie signature valid but user is missing / suspended (e.g. deleted
    // after the session was issued). Send them to /login — the next login
    // overwrites the cookie. Redirect here instead of throwing so we don't
    // hand back a 500.
    redirect("/login");
  }

  // No cookie at all — the middleware should have caught this. If we reach
  // here it's a bug (or a route missed from the public prefixes). Redirect
  // anyway so the user has a working next step.
  redirect("/login");
});
