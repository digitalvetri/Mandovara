// Owner deny-carveout test — segregation of duties (spec §5 test #5).
//
// The Owner role has isOwnerRole=true (grants every permission by
// default), but explicit RolePermission rows with scope=NONE are treated
// as denies inside session.resolveContext. This test builds a full role
// with those deny rows and confirms:
//   - measurement.create.any / .own / (legacy) create are NOT in the ctx set
//   - measurement.approve.any IS still in the ctx set

import { beforeAll, describe, expect, it } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { resolveContext } from "@/kernel/auth/session";
import type { PermissionKey } from "@/kernel/rbac/permissions";
import { setupTwoTenants, type Tenant } from "./fixtures";

const OWNER_DENIES: PermissionKey[] = [
  "measurement.create.any", "measurement.create.own",
  "measurement.edit.any",   "measurement.edit.own",
  "measurement.submit.any", "measurement.submit.own",
  "measurement.create", "measurement.update", "measurement.submit",
];

let A: Tenant;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;

  // Wire an Owner dynamic role with the deny rows attached, then link
  // the tenant's user to it. Mirrors what prisma/seed/roles.ts does.
  const role = await db.role.create({
    data: {
      organizationId: A.orgId,
      name:           "Owner (test)",
      description:    "Test",
      isOwnerRole:    true,
      isSystem:       true,
    },
    select: { id: true },
  });
  await db.rolePermission.createMany({
    data: OWNER_DENIES.map((key) => ({ roleId: role.id, key, scope: "NONE" as const })),
  });
  await db.user.update({ where: { id: A.userId }, data: { roleId: role.id } });
});

describe("Owner deny carveouts (session.resolveContext)", () => {
  it("Owner ctx does NOT carry measurement.create.any (deny applied)", async () => {
    const ctx = await resolveContext(
      { userId: A.userId, orgId: A.orgId, issuedAt: 0, expiresAt: 0 },
    );
    for (const denied of OWNER_DENIES) {
      expect(ctx.permissions.has(denied)).toBe(false);
    }
  });

  it("Owner ctx STILL carries measurement.approve.any (not denied)", async () => {
    const ctx = await resolveContext(
      { userId: A.userId, orgId: A.orgId, issuedAt: 0, expiresAt: 0 },
    );
    expect(ctx.permissions.has("measurement.approve.any")).toBe(true);
  });

  it("Owner ctx still carries unrelated permissions (invoice, catalog, etc.)", async () => {
    const ctx = await resolveContext(
      { userId: A.userId, orgId: A.orgId, issuedAt: 0, expiresAt: 0 },
    );
    expect(ctx.permissions.has("invoice.create")).toBe(true);
    expect(ctx.permissions.has("catalog.view")).toBe(true);
    expect(ctx.permissions.has("client.viewOthers")).toBe(true);
  });
});
