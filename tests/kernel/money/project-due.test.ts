import { describe, it, expect } from "vitest";
import {
  pickAgreedValue,
  computeProjectDue,
  computeProjectCredit,
  combineProjectDue,
  accumulateReceived,
  isProjectFullySettled,
  collectedPct,
} from "@/kernel/money/project-due";

describe("pickAgreedValue", () => {
  it("prefers the accepted quotation over everything else", () => {
    expect(pickAgreedValue(500_000n, 900_000n, 100_000n)).toBe(500_000n);
  });

  it("falls back to the latest quotation when none is accepted yet", () => {
    expect(pickAgreedValue(null, 900_000n, 100_000n)).toBe(900_000n);
  });

  it("falls back to the stored order value for pre-quotation projects", () => {
    expect(pickAgreedValue(null, null, 100_000n)).toBe(100_000n);
  });

  it("treats a zero accepted total as no agreement and keeps looking", () => {
    expect(pickAgreedValue(0n, 900_000n, 100_000n)).toBe(900_000n);
  });

  it("returns 0 when there is nothing to go on", () => {
    expect(pickAgreedValue(null, null, 0n)).toBe(0n);
  });
});

describe("computeProjectDue", () => {
  it("nothing received — the whole agreement is due", () => {
    expect(computeProjectDue(500_000n, 0n)).toBe(500_000n);
  });

  it("advance received — due is reduced by exactly that much", () => {
    expect(computeProjectDue(500_000n, 200_000n)).toBe(300_000n);
  });

  it("paid in full — nothing due", () => {
    expect(computeProjectDue(500_000n, 500_000n)).toBe(0n);
  });

  it("overpaid — clamps at 0, never negative", () => {
    expect(computeProjectDue(500_000n, 600_000n)).toBe(0n);
  });
});

describe("computeProjectCredit", () => {
  it("no overpayment — no credit", () => {
    expect(computeProjectCredit(500_000n, 300_000n)).toBe(0n);
  });

  it("overpayment surfaces as credit", () => {
    expect(computeProjectCredit(500_000n, 600_000n)).toBe(100_000n);
  });
});

describe("isProjectFullySettled", () => {
  it("false while money is still owed", () => {
    expect(isProjectFullySettled(500_000n, 499_999n)).toBe(false);
  });

  it("true on the exact rupee", () => {
    expect(isProjectFullySettled(500_000n, 500_000n)).toBe(true);
  });

  it("true when overpaid", () => {
    expect(isProjectFullySettled(500_000n, 700_000n)).toBe(true);
  });

  it("a project with no agreed value is never settled — the invoice gate stays shut", () => {
    expect(isProjectFullySettled(0n, 0n)).toBe(false);
    expect(isProjectFullySettled(0n, 100n)).toBe(false);
  });
});

describe("collectedPct", () => {
  it("half collected", () => {
    expect(collectedPct(500_000n, 250_000n)).toBe(50);
  });

  it("caps at 100 when overpaid", () => {
    expect(collectedPct(500_000n, 900_000n)).toBe(100);
  });

  it("0 when there is no agreement to measure against", () => {
    expect(collectedPct(0n, 900_000n)).toBe(0);
  });
});

describe("combineProjectDue — a bill can exceed the quotation", () => {
  it("normal job — the agreement is the whole story", () => {
    expect(combineProjectDue(300_000n, 0n)).toBe(300_000n);
  });

  it("billed for extra work agreed on site — the extra stays visible", () => {
    // Quoted 400k, paid 400k, then billed 450k for work added on site.
    // The agreement is settled; the bill is 50k short.
    expect(combineProjectDue(0n, 50_000n)).toBe(50_000n);
  });

  it("billed early for the full quote — counted once, not twice", () => {
    // Nothing paid: the agreement says 400k owed and the invoice says the
    // same 400k. It must not read as 800k.
    expect(combineProjectDue(400_000n, 400_000n)).toBe(400_000n);
  });

  it("settled and fully billed — nothing owed", () => {
    expect(combineProjectDue(0n, 0n)).toBe(0n);
  });
});

describe("isProjectFullySettled with an over-billed invoice", () => {
  it("the agreement being paid off is not enough while a bill is short", () => {
    expect(isProjectFullySettled(400_000n, 400_000n, 50_000n)).toBe(false);
  });

  it("settled once both are clear", () => {
    expect(isProjectFullySettled(400_000n, 400_000n, 0n)).toBe(true);
  });
});

describe("accumulateReceived — raising the bill must not change the total", () => {
  const advance = 150_000n;
  const balance = 250_000n;

  it("before the invoice, both payments sit against the job", () => {
    expect(accumulateReceived({
      notOnABill:          [advance, balance],
      onThisProjectsBills: [],
      legacyAdvances:      [],
    })).toBe(400_000n);
  });

  it("after the sweep, the same money sits on the bill — same total", () => {
    // This is what sweepProjectReceiptsOntoInvoice does: it zeroes
    // Receipt.unallocated and writes ReceiptAllocation rows for the same
    // amounts. If the total moved, the project would appear to gain or lose
    // money at the moment it was invoiced.
    expect(accumulateReceived({
      notOnABill:          [0n, 0n],
      onThisProjectsBills: [advance, balance],
      legacyAdvances:      [],
    })).toBe(400_000n);
  });

  it("a partial sweep — an invoice smaller than what was collected", () => {
    expect(accumulateReceived({
      notOnABill:          [0n, 100_000n],
      onThisProjectsBills: [advance, 150_000n],
      legacyAdvances:      [],
    })).toBe(400_000n);
  });

  it("legacy Advance rows count alongside, not instead", () => {
    expect(accumulateReceived({
      notOnABill:          [50_000n],
      onThisProjectsBills: [],
      legacyAdvances:      [25_000n],
    })).toBe(75_000n);
  });

  it("nothing received", () => {
    expect(accumulateReceived({
      notOnABill: [], onThisProjectsBills: [], legacyAdvances: [],
    })).toBe(0n);
  });
});
