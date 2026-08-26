// Unit tests for the "next action" resolver. Pure function — no DB.
// Covers the spec's UI-contract tests: the CTA the user sees, and whether
// it's enabled or disabled with the expected explanatory line.
//
// Owner redesign (2026-08-26): the pre-order internal stages (ENQUIRY,
// SITE_VISIT, MEASUREMENT, QUOTATION) all share a single primary CTA
// "Prepare firm quote". Site visit + measurement are anytime side-actions
// on the project page and are covered by UI tests, not this resolver.

import { describe, expect, it } from "vitest";
import type { RequestContext } from "@/kernel/auth/context";
import { resolveNextAction, phaseForStageWithMoney } from "@/modules/projects/next-action";

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

describe("resolveNextAction — pre-order stages collapse to Prepare firm quote", () => {
  it.each(["ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION"])(
    "stage=%s → BUILD_QUOTATION with 'Prepare firm quote'",
    (stage) => {
      const ctx = ctxWith(["project.view", "quotation.create"]);
      const a = resolveNextAction(ctx, { id: "p1", clientId: "c1", stage });
      expect(a.kind).toBe("BUILD_QUOTATION");
      expect(a.label).toBe("Prepare firm quote");
      expect(a.href).toBe("/quotations?project=p1");
      expect(a.enabled).toBe(true);
    },
  );

  it("is disabled with the sales/designers reason when quotation.create is missing", () => {
    const ctx = ctxWith(["project.view"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "QUOTATION" });
    expect(a.enabled).toBe(false);
    expect(a.disabledReason).toContain("sales / designers");
  });

  it("quotation.send alone (no create) still enables the CTA — sender can nudge", () => {
    const ctx = ctxWith(["project.view", "quotation.send"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "ENQUIRY" });
    expect(a.enabled).toBe(true);
  });
});

describe("resolveNextAction — post-order stages", () => {
  const perms = new Set(["project.update", "quotation.create", "po.create",
    "allocation.create"]);
  const ctx = ctxWith([...perms]);

  it.each([
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

describe("phaseForStageWithMoney — INVOICE vs ADVANCE split", () => {
  it("ORDERED with no money snapshot → INVOICE", () => {
    expect(phaseForStageWithMoney("ORDERED", null)).toBe("INVOICE");
  });

  it("ORDERED with invoiceTotal 0 → INVOICE", () => {
    expect(phaseForStageWithMoney("ORDERED", {
      invoiceTotal: 0n, advanceReceived: 0n, advanceRequired: 500_00n,
    })).toBe("INVOICE");
  });

  it("ORDERED with invoiceTotal > 0 → ADVANCE", () => {
    expect(phaseForStageWithMoney("ORDERED", {
      invoiceTotal: 10_000_00n, advanceReceived: 0n, advanceRequired: 500_00n,
    })).toBe("ADVANCE");
  });

  it("non-ORDERED stages ignore money and delegate to phaseForStage", () => {
    const m = { invoiceTotal: 10_000_00n, advanceReceived: 0n, advanceRequired: 500_00n };
    expect(phaseForStageWithMoney("ENQUIRY", m)).toBe("PROJECT");
    expect(phaseForStageWithMoney("PROCUREMENT", m)).toBe("INSTALLATION");
    expect(phaseForStageWithMoney("COMPLETED", m)).toBe("COMPLETED");
    expect(phaseForStageWithMoney("CANCELLED", m)).toBe("CANCELLED");
  });
});
