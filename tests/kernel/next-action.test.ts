// Unit tests for the "next action" resolver. Pure function — no DB.
// Covers the spec's UI-contract tests: the CTA the user sees, and whether
// it's enabled or disabled with the expected explanatory line.

import { describe, expect, it } from "vitest";
import type { RequestContext } from "@/kernel/auth/context";
import { resolveNextAction } from "@/modules/projects/next-action";

function ctxWith(perms: readonly string[]): RequestContext {
  return {
    userId: "u1",
    orgId:  "o1",
    branchIds: [],
    branchScope: "ALL",
    roles: ["test"],
    permissions: new Set(perms as never[]),
    ip: "127.0.0.1",
  };
}

const PROJECT = { id: "p1", stage: "SITE_VISIT" };

describe("resolveNextAction — measurement stages", () => {
  it("Owner at SITE_VISIT is DISABLED with the segregation-of-duties reason", () => {
    // Owner explicitly has no measurement.create.* keys (seed §5 carveouts).
    const ctx = ctxWith(["project.view", "measurement.approve.any"]);
    const a = resolveNextAction(ctx, PROJECT);
    expect(a.kind).toBe("START_MEASUREMENT");
    expect(a.enabled).toBe(false);
    expect(a.disabledReason).toContain("measurement team");
  });

  it("Measurement executive at SITE_VISIT is ENABLED (has create.any)", () => {
    const ctx = ctxWith(["project.view", "measurement.create.any"]);
    const a = resolveNextAction(ctx, PROJECT);
    expect(a.enabled).toBe(true);
    expect(a.disabledReason).toBeNull();
    expect(a.cta).toBe("Start measurement");
  });

  it("Sales exec at SITE_VISIT with create.own is ENABLED", () => {
    const ctx = ctxWith(["project.view", "measurement.create.own"]);
    const a = resolveNextAction(ctx, PROJECT);
    expect(a.enabled).toBe(true);
  });

  it("legacy flat measurement.create still enables (backwards compat)", () => {
    const ctx = ctxWith(["project.view", "measurement.create"]);
    const a = resolveNextAction(ctx, PROJECT);
    expect(a.enabled).toBe(true);
  });
});

describe("resolveNextAction — stage → CTA mapping", () => {
  const perms = new Set(["project.update", "quotation.create", "po.create",
    "allocation.create"]);
  const ctx = ctxWith([...perms]);

  it.each([
    ["ENQUIRY",      "SCHEDULE_VISIT",     "Schedule a site visit"],
    ["QUOTATION",    "BUILD_QUOTATION",    "Build the quotation"],
    ["ORDERED",      "RAISE_PROCUREMENT",  "Raise purchase requests"],
    // Label changed when the dye-lot allocation console was removed — the
    // stage still exists, but there is nothing to allocate to any more.
    ["PROCUREMENT",  "ALLOCATE_MATERIAL",  "Material in procurement"],
    ["CANCELLED",    "PROJECT_CANCELLED",  "This project was cancelled"],
  ])("stage=%s → kind=%s / label=%s", (stage, kind, label) => {
    const a = resolveNextAction(ctx, { id: "p1", stage });
    expect(a.kind).toBe(kind);
    expect(a.label).toContain(label);
  });

  it("stage=MAKE reflects make progress in subLine", () => {
    const a = resolveNextAction(ctx, {
      id: "p1", stage: "MAKE",
      makeInProgress: { done: 3, total: 5 },
    });
    expect(a.subLine).toBe("3 of 5 done");
  });
});

describe("resolveNextAction — disabled fallbacks", () => {
  it("QUOTATION without quotation.create is disabled with the right reason", () => {
    const ctx = ctxWith(["project.view"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "QUOTATION" });
    expect(a.enabled).toBe(false);
    expect(a.disabledReason).toContain("sales / designers");
  });

  it("PROCUREMENT without allocation.create is disabled", () => {
    const ctx = ctxWith(["project.view"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "PROCUREMENT" });
    expect(a.enabled).toBe(false);
    expect(a.disabledReason).toContain("store team");
  });

  it("CANCELLED is disabled regardless of perms", () => {
    const ctx = ctxWith(["project.update", "quotation.create", "measurement.create.any"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "CANCELLED" });
    expect(a.enabled).toBe(false);
  });
});
