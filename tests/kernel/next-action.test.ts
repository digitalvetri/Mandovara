// Unit tests for the "next action" resolver. Pure function — no DB.
// Covers the spec's UI-contract tests: the CTA the user sees, and whether
// it's enabled or disabled with the expected explanatory line.
//
// Owner correction (2026-09-10): the resolver used to say "Create invoice"
// at every pre-order stage and again as the first step after acceptance —
// it asked the studio to bill before the client had agreed a price, and to
// bill before collecting. The real order is quote → advance → work →
// balance → invoice, and these tests pin each hand-off in that order.

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

// Destination changed on 2026-08-30. /invoicing/new is the order-backed
// picker, which reports "no projects ready to invoice" for exactly these
// pre-order stages — it was sending an owner to a page that told them
// they could not do the thing they had just clicked. /invoicing/create
// writes the invoice for the project directly.
describe("resolveNextAction — the quotation comes before the invoice", () => {
  it.each(["ENQUIRY", "SITE_VISIT", "MEASUREMENT", "QUOTATION"])(
    "stage=%s with no quotation yet → price the job, not bill it",
    (stage) => {
      const ctx = ctxWith(["project.view", "invoice.create", "quotation.create"]);
      const a = resolveNextAction(ctx, { id: "p1", clientId: "c1", stage });
      expect(a.kind).toBe("BUILD_QUOTATION");
      expect(a.cta).toBe("Create quotation");
      expect(a.href).toBe("/quotations/new?project=p1");
      expect(a.enabled).toBe(true);
      // The thing it must never do at this point: bill a client who has not
      // been told what the job costs.
      expect(a.href).not.toContain("/invoicing");
    },
  );

  it("a quotation is out and unpaid → collect on it", () => {
    const ctx = ctxWith(["project.view", "receipt.create"]);
    const a = resolveNextAction(ctx, {
      id: "p1", clientId: "c1", stage: "QUOTATION",
      hasQuotation: true,
      money: {
        invoiceTotal: 0n, advanceReceived: 0n, advanceRequired: 0n,
        agreedValue: 400_000_00n, outstanding: 400_000_00n,
      },
    });
    expect(a.kind).toBe("RECORD_ADVANCE");
    expect(a.href).toBe("/accounts/new?clientId=c1");
  });

  it("part paid → the CTA says so and still points at the payment sheet", () => {
    const ctx = ctxWith(["project.view", "receipt.create"]);
    const a = resolveNextAction(ctx, {
      id: "p1", clientId: "c1", stage: "QUOTATION",
      hasQuotation: true,
      money: {
        invoiceTotal: 0n, advanceReceived: 100_000_00n, advanceRequired: 0n,
        agreedValue: 400_000_00n, outstanding: 300_000_00n,
      },
    });
    expect(a.kind).toBe("RECORD_ADVANCE");
    expect(a.label).toContain("Part paid");
  });

  it("is disabled with the sales-team reason when quotation.create is missing", () => {
    const ctx = ctxWith(["project.view"]);
    const a = resolveNextAction(ctx, { id: "p1", stage: "QUOTATION" });
    expect(a.enabled).toBe(false);
    expect(a.disabledReason).toContain("sales team");
  });
});

describe("resolveNextAction — post-order stages", () => {
  const perms = new Set(["project.update", "quotation.create", "po.create",
    "allocation.create"]);
  const ctx = ctxWith([...perms]);

  it.each([
    // Owner canonical flow post-acceptance: advance → work → balance →
    // invoice. With no money snapshot the ORDERED CTA is "Record advance".
    ["ORDERED",      "RECORD_ADVANCE",     "awaiting advance"],
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

  it("stage=ORDERED with money loaded walks advance → install → invoice", () => {
    const richCtx = ctxWith(["invoice.create", "receipt.create", "sitelog.create"]);

    // Nothing received — the advance is the next thing, not a bill.
    const step1 = resolveNextAction(richCtx, {
      id: "p1", stage: "ORDERED",
      money: {
        invoiceTotal: 0n, advanceReceived: 0n, advanceRequired: 500_00n,
        agreedValue: 10_000_00n, outstanding: 10_000_00n,
      },
    });
    expect(step1.kind).toBe("RECORD_ADVANCE");
    expect(step1.enabled).toBe(true);

    // Advance in, balance still to come — work can start.
    const step2 = resolveNextAction(richCtx, {
      id: "p1", stage: "ORDERED",
      money: {
        invoiceTotal: 0n, advanceReceived: 500_00n, advanceRequired: 500_00n,
        agreedValue: 10_000_00n, outstanding: 9_500_00n,
      },
    });
    expect(step2.kind).toBe("SCHEDULE_INSTALL");
    expect(step2.cta).toBe("Book install visit");
    expect(step2.subLine).toContain("Balance");

    // Paid in full and not billed — now, and only now, the invoice.
    const step3 = resolveNextAction(richCtx, {
      id: "p1", stage: "ORDERED",
      money: {
        invoiceTotal: 0n, advanceReceived: 10_000_00n, advanceRequired: 500_00n,
        agreedValue: 10_000_00n, outstanding: 0n,
      },
    });
    expect(step3.kind).toBe("CREATE_INVOICE");
    expect(step3.href).toBe("/invoicing/create?project=p1");
  });

  it("a completed job with a balance keeps chasing it", () => {
    const richCtx = ctxWith(["invoice.create", "receipt.create"]);
    const a = resolveNextAction(richCtx, {
      id: "p1", clientId: "c1", stage: "COMPLETED",
      money: {
        invoiceTotal: 0n, advanceReceived: 1_000_00n, advanceRequired: 0n,
        agreedValue: 10_000_00n, outstanding: 9_000_00n,
      },
    });
    expect(a.kind).toBe("RECORD_ADVANCE");
    expect(a.label).toContain("balance to collect");
  });

  it("a completed job paid in full and unbilled offers the invoice", () => {
    const richCtx = ctxWith(["invoice.create", "receipt.create"]);
    const a = resolveNextAction(richCtx, {
      id: "p1", clientId: "c1", stage: "COMPLETED",
      money: {
        invoiceTotal: 0n, advanceReceived: 10_000_00n, advanceRequired: 0n,
        agreedValue: 10_000_00n, outstanding: 0n,
      },
    });
    expect(a.kind).toBe("CREATE_INVOICE");
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

describe("phaseForStageWithMoney — the stepper reads in the real order", () => {
  it("ORDERED means the quotation was agreed and money is awaited", () => {
    expect(phaseForStageWithMoney("ORDERED", null)).toBe("ADVANCE");
    expect(phaseForStageWithMoney("ORDERED", {
      invoiceTotal: 0n, advanceReceived: 0n, advanceRequired: 500_00n,
    })).toBe("ADVANCE");
  });

  it("the internal QUOTATION stage has a phase of its own", () => {
    expect(phaseForStageWithMoney("QUOTATION", null)).toBe("QUOTATION");
  });

  it("money already received moves it on, whatever the stage still says", () => {
    expect(phaseForStageWithMoney("QUOTATION", {
      invoiceTotal: 0n, advanceReceived: 100_00n, advanceRequired: 0n,
    })).toBe("ADVANCE");
  });

  it("non-quotation stages ignore money and delegate to phaseForStage", () => {
    const m = { invoiceTotal: 10_000_00n, advanceReceived: 0n, advanceRequired: 500_00n };
    expect(phaseForStageWithMoney("ENQUIRY", m)).toBe("PROJECT");
    expect(phaseForStageWithMoney("PROCUREMENT", m)).toBe("INSTALLATION");
    expect(phaseForStageWithMoney("COMPLETED", m)).toBe("COMPLETED");
    expect(phaseForStageWithMoney("CANCELLED", m)).toBe("CANCELLED");
  });
});
