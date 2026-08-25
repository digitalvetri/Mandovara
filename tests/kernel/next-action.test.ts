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

const PROJECT = { id: "p1", clientId: "c1", stage: "SITE_VISIT" };

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
    // Owner canonical flow post-acceptance: invoice → advance → install.
    // With no money snapshot (test defaults), the ORDERED CTA is "Create
    // invoice" not the retired "Prepare material" pointing to procurement.
    ["ORDERED",      "CREATE_INVOICE",     "Firm quote accepted"],
    // Owner canonical flow: after advance is received the project stage
    // moves to PROCUREMENT internally but the visible CTA jumps straight
    // to "Book install visit" (procurement happens in the background).
    ["PROCUREMENT",  "SCHEDULE_INSTALL",   "Advance received — ready to install"],
    ["CANCELLED",    "PROJECT_CANCELLED",  "This project was cancelled"],
  ])("stage=%s → kind=%s / label=%s", (stage, kind, label) => {
    const a = resolveNextAction(ctx, { id: "p1", stage });
    expect(a.kind).toBe(kind);
    expect(a.label).toContain(label);
  });

  it("stage=ORDERED with money loaded walks invoice → advance → install", () => {
    const richCtx = ctxWith(["invoice.create", "receipt.create", "sitelog.create"]);
    // no invoice yet
    const step1 = resolveNextAction(richCtx, {
      id: "p1", stage: "ORDERED",
      money: { invoiceTotal: 0n, advanceReceived: 0n, advanceRequired: 500_00n },
    });
    expect(step1.kind).toBe("CREATE_INVOICE");
    expect(step1.enabled).toBe(true);

    // invoice raised, no advance yet
    const step2 = resolveNextAction(richCtx, {
      id: "p1", stage: "ORDERED",
      money: { invoiceTotal: 10_000_00n, advanceReceived: 0n, advanceRequired: 500_00n },
    });
    expect(step2.kind).toBe("RECORD_ADVANCE");

    // advance met — install unlocks without waiting on MAKE
    const step3 = resolveNextAction(richCtx, {
      id: "p1", stage: "ORDERED",
      money: { invoiceTotal: 10_000_00n, advanceReceived: 500_00n, advanceRequired: 500_00n },
    });
    expect(step3.kind).toBe("SCHEDULE_INSTALL");
    expect(step3.cta).toBe("Book install visit");
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

  it("PROCUREMENT without install perms is disabled with a sales-team reason", () => {
    const ctx = ctxWith(["project.view"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "PROCUREMENT" });
    expect(a.enabled).toBe(false);
    expect(a.disabledReason).toContain("sales team");
  });

  it("CANCELLED is disabled regardless of perms", () => {
    const ctx = ctxWith(["project.update", "quotation.create", "measurement.create.any"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "CANCELLED" });
    expect(a.enabled).toBe(false);
  });
});
