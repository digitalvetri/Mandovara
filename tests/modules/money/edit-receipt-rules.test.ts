// Correcting a wrongly entered payment — owner request 2026-10-24.

import { describe, it, expect } from "vitest";
import { planReceiptEdit } from "../../../src/modules/receipts/edit-rules";

const base = {
  amount: 20_000_00n, mode: "CASH" as const, allocated: 0n,
  previousMode: "CASH" as const, previousCheque: null,
};

describe("planReceiptEdit", () => {
  it("changes the amount of a payment on account", () => {
    const p = planReceiptEdit({ ...base, amount: 25_000_00n });
    expect(p).toEqual({ ok: true, unallocated: 25_000_00n, chequeStatus: null, clearChequeDate: true });
  });

  it("keeps money already on invoices allocated and the rest on account", () => {
    const p = planReceiptEdit({ ...base, amount: 30_000_00n, allocated: 10_000_00n });
    expect(p.ok && p.unallocated).toBe(20_000_00n);
  });

  it("refuses to cut a payment below what it already paid on invoices", () => {
    const p = planReceiptEdit({ ...base, amount: 5_000_00n, allocated: 10_000_00n });
    expect(p.ok).toBe(false);
  });

  it("refuses zero", () => {
    expect(planReceiptEdit({ ...base, amount: 0n }).ok).toBe(false);
  });

  it("refuses to edit a bounced cheque", () => {
    const p = planReceiptEdit({ ...base, mode: "CHEQUE", previousMode: "CHEQUE", previousCheque: "BOUNCED" });
    expect(p.ok).toBe(false);
  });

  it("starts cheque tracking when the mode becomes cheque", () => {
    const p = planReceiptEdit({ ...base, mode: "CHEQUE" });
    expect(p.ok && p.chequeStatus).toBe("PENDING");
    expect(p.ok && p.clearChequeDate).toBe(false);
  });

  it("keeps a cleared cheque cleared when only the amount changes", () => {
    const p = planReceiptEdit({ ...base, mode: "CHEQUE", previousMode: "CHEQUE", previousCheque: "CLEARED" });
    expect(p.ok && p.chequeStatus).toBe("CLEARED");
  });

  it("drops cheque tracking when the mode changes away from cheque", () => {
    const p = planReceiptEdit({ ...base, mode: "UPI", previousMode: "CHEQUE", previousCheque: "PENDING" });
    expect(p).toEqual({ ok: true, unallocated: 20_000_00n, chequeStatus: null, clearChequeDate: true });
  });
});
