// RBAC guard tests — permission enforcement.

import { describe, expect, it } from "vitest";
import type { RequestContext } from "@/kernel/auth/context";
import { can, ForbiddenError, requirePermission } from "@/kernel/rbac/guard";
import { ALL_PERMISSION_KEYS } from "@/kernel/rbac/permissions";

function makeCtx(perms: string[]): RequestContext {
  return {
    userId: "u1", orgId: "o1", branchIds: [], branchScope: "ALL",
    roles: ["test"], permissions: new Set(perms as Parameters<typeof requirePermission>[1][]),
  };
}

describe("requirePermission", () => {
  it("throws ForbiddenError when the permission is missing", () => {
    const ctx = makeCtx([]);
    expect(() => requirePermission(ctx, "invoice.create")).toThrow(ForbiddenError);
  });

  it("passes silently when the permission is present", () => {
    const ctx = makeCtx(["invoice.create"]);
    expect(() => requirePermission(ctx, "invoice.create")).not.toThrow();
  });

  it("attaches the permission and 403 status to the error", () => {
    const ctx = makeCtx([]);
    try {
      requirePermission(ctx, "payroll.run");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenError);
      const err = e as ForbiddenError;
      expect(err.permission).toBe("payroll.run");
      expect(err.status).toBe(403);
      expect(err.message).toContain("payroll.run");
    }
  });

  it("can() is non-throwing and mirrors the guard", () => {
    const ctx = makeCtx(["client.view"]);
    expect(can(ctx, "client.view")).toBe(true);
    expect(can(ctx, "client.creditLimit")).toBe(false);
  });
});

describe("permission registry", () => {
  it("exposes a flat list with no duplicates", () => {
    const set = new Set(ALL_PERMISSION_KEYS);
    expect(set.size).toBe(ALL_PERMISSION_KEYS.length);
    expect(set.size).toBeGreaterThan(80); // sanity — we have ~100+ keys
  });

  it("every registry entry follows the module.action shape", () => {
    for (const k of ALL_PERMISSION_KEYS) {
      expect(k).toMatch(/^[a-z][a-zA-Z]*\.[a-z][a-zA-Z.]*$/);
    }
  });
});
