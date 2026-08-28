// Lead visibility — the rule that leads belong to the employee they are
// assigned to.
//
// These are pure-function tests over the decision itself. The wiring
// (listLeads, getLead, the badge counts, the mutations) all funnels
// through these three helpers, so getting the decision wrong here is the
// only way the module can leak; getting it right and forgetting to call
// it is what the greps in the accompanying commit cover.

import { describe, it, expect } from "vitest";
import type { RequestContext } from "../../src/kernel/auth/context";
import type { PermissionKey } from "../../src/kernel/rbac/permissions";
import {
  canTouchLead, canViewOthersLeads, leadVisibilityWhere,
} from "../../src/modules/leads/scope";

function ctxWith(userId: string, perms: string[]): RequestContext {
  return {
    userId,
    orgId: "org_1",
    branchIds: [],
    branchScope: "ALL",
    roles: [],
    permissions: new Set(perms as PermissionKey[]),
  };
}

const OWNER    = ctxWith("u_owner", ["lead.view", "lead.viewOthers"]);
const EMPLOYEE = ctxWith("u_emp",   ["lead.view"]);

describe("lead visibility", () => {
  it("a user with lead.viewOthers sees the whole pipeline", () => {
    expect(canViewOthersLeads(OWNER)).toBe(true);
    // {} — no narrowing, safe to spread into any where clause.
    expect(leadVisibilityWhere(OWNER)).toEqual({});
  });

  it("a user without it is narrowed to leads they own", () => {
    expect(canViewOthersLeads(EMPLOYEE)).toBe(false);
    expect(leadVisibilityWhere(EMPLOYEE)).toEqual({ ownerId: "u_emp" });
  });

  it("lead.view alone does not grant sight of other people's leads", () => {
    // The exact bug reported: `lead.view` was treated as "see everything".
    expect(leadVisibilityWhere(EMPLOYEE)).not.toEqual({});
  });

  it("an employee may touch their own lead", () => {
    expect(canTouchLead(EMPLOYEE, { ownerId: "u_emp" })).toBe(true);
  });

  it("an employee may not touch someone else's lead", () => {
    // Covers the hand-made-POST case: the list is narrowed, but edit,
    // convert and delete each re-check server-side (CLAUDE.md rule 11).
    expect(canTouchLead(EMPLOYEE, { ownerId: "u_other" })).toBe(false);
  });

  it("a user with viewOthers may touch any lead", () => {
    expect(canTouchLead(OWNER, { ownerId: "u_someone_else" })).toBe(true);
  });
});
