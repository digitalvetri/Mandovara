// DEV-ONLY RequestContext helper. Until Phase 7 lands real auth (mobile-
// number-first login, Argon2id, httpOnly cookies), the app runs as the
// seeded organisation Owner so we can build modules against real data.
//
// Deliberately placed OUTSIDE src/kernel/** because Rule 10 forbids
// automated changes to the kernel. This lives at the module boundary and
// is gated on NODE_ENV !== "production" — throws in prod so the bypass
// cannot escape into a deployment.
//
// New User model (CLAUDE.md §5): direct `role AppRole` field.

import { prisma } from "@/kernel/db/client";
import type { RequestContext } from "@/kernel/auth/context";
import { PERMISSIONS, type PermissionKey } from "@/kernel/rbac/permissions";

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
  permissions: (() => {
    const s = new Set<PermissionKey>();
    for (const [mod, actions] of Object.entries(PERMISSIONS))
      for (const a of actions) s.add(`${mod}.${a}` as PermissionKey);
    return s;
  })(),
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
      },
    });

    cached = {
      userId: user.id,
      orgId: user.organizationId,
      branchIds: user.branchIds,
      branchScope: "ALL",
      roles: [user.role as string],
      permissions: allRegisteredPermissions(),
    };
  } catch {
    console.warn("[devContext] DB unreachable — using stub context. Start Docker to load real data.");
    cached = STUB_CONTEXT;
  }

  return cached;
}
