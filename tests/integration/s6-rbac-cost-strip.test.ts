// §12.2 Scenario 6 — INSTALLER: cost price and margin absent from all responses.
//
// Because devContext() is pinned to OWNER in the dev server, the browser-level
// E2E for this scenario cannot be run without real session auth.
//
// Two test files together cover this gate completely:
//   tests/integration/s6-rbac-cost-strip.test.ts  ← this file
//     Verifies the RBAC logic: INSTALLER ctx lacks catalog.viewCost, order.viewMargin,
//     invoice.viewMargin; requirePermission() throws ForbiddenError for each.
//
//   tests/kernel/catalog-cost-strip.test.ts        ← the authoritative gate
//     Hits the REAL DATABASE. Seeds a Colourway with COST + RETAIL prices.
//     Calls searchDesigns() with INSTALLER ctx → COST absent, RETAIL visible.
//     Calls searchDesigns() with OWNER ctx → COST visible.
//     If the `tier: { not: "COST" }` filter is removed from queries.ts, that
//     test goes red for INSTALLER. This file cannot catch that deletion.
//
// Spec reference: CLAUDE.md §3.1 "cost & margin: OWNER, ACCOUNTS only", §0.7.

import { describe, it, expect } from "vitest";
import type { RequestContext } from "@/kernel/auth/context";
import { can, requirePermission, ForbiddenError } from "@/kernel/rbac/guard";
import { ALL_PERMISSION_KEYS } from "@/kernel/rbac/permissions";

// ── Context builders ──────────────────────────────────────────────────────────

function makeCtx(perms: string[]): RequestContext {
  return {
    userId:      "u1",
    orgId:       "o1",
    branchIds:   [],
    branchScope: "ALL",
    roles:       ["test"],
    permissions: new Set(perms) as unknown as ReadonlySet<Parameters<typeof requirePermission>[1]>,
  };
}

// INSTALLER permissions per §3.1: install module access, project view, catalog view — no financials.
const INSTALLER_PERMS = [
  "project.view",
  "catalog.view",
  "install.view",
  "install.create",
  "install.update",
  "install.complete",
  "install.raiseSnag",
  "sitelog.view",
  "sitelog.create",
];

// OWNER has everything; ACCOUNTS has cost/margin visibility per §3.1.
const COST_MARGIN_KEYS = [
  "catalog.viewCost",
  "order.viewMargin",
  "invoice.viewMargin",
] as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("§12.2 S6 — cost & margin gate (OWNER / ACCOUNTS only)", () => {

  describe("INSTALLER context blocks cost and margin permissions", () => {
    const installerCtx = makeCtx(INSTALLER_PERMS);

    for (const key of COST_MARGIN_KEYS) {
      it(`cannot ${key}`, () => {
        expect(can(installerCtx, key)).toBe(false);
      });

      it(`requirePermission throws ForbiddenError for ${key}`, () => {
        expect(() => requirePermission(installerCtx, key)).toThrow(ForbiddenError);
      });
    }
  });

  describe("OWNER context has all cost and margin permissions", () => {
    const ownerCtx = makeCtx([...COST_MARGIN_KEYS]);

    for (const key of COST_MARGIN_KEYS) {
      it(`can ${key}`, () => {
        expect(can(ownerCtx, key)).toBe(true);
      });
    }
  });

  describe("ACCOUNTS context has all cost and margin permissions", () => {
    const accountsCtx = makeCtx([...COST_MARGIN_KEYS]);

    for (const key of COST_MARGIN_KEYS) {
      it(`can ${key}`, () => {
        expect(can(accountsCtx, key)).toBe(true);
      });
    }
  });

  describe("INSTALLER can access installation permissions", () => {
    const installerCtx = makeCtx(INSTALLER_PERMS);

    it("can install.view", () => expect(can(installerCtx, "install.view")).toBe(true));
    it("can install.complete", () => expect(can(installerCtx, "install.complete")).toBe(true));
    it("can install.raiseSnag", () => expect(can(installerCtx, "install.raiseSnag")).toBe(true));
    it("can catalog.view (browse, but not cost)", () => expect(can(installerCtx, "catalog.view")).toBe(true));
  });

  describe("cost & margin keys exist in the permission registry", () => {
    for (const key of COST_MARGIN_KEYS) {
      it(`${key} is a known registry key`, () => {
        expect(ALL_PERMISSION_KEYS).toContain(key);
      });
    }
  });
});
