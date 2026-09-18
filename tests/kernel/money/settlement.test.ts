// Settlement discount arithmetic.
//
// The case from the owner's screen: quoted ₹1,05,410, received ₹98,000,
// the client is let off the remaining ₹7,410. Every figure below is paise.

import { describe, it, expect } from "vitest";
import {
  netAgreedValue, settlementDiscountProblem, spreadDiscount, rateForTaxable,
} from "@/kernel/money/settlement";
import { computeLineTax } from "@/kernel/tax/gst";
import { applyLineDiscount } from "@/kernel/tax/gst";

describe("netAgreedValue", () => {
  it("takes the discount off what the client is held to", () => {
    expect(netAgreedValue(10_541_000n, 741_000n)).toBe(9_800_000n);
  });

  it("is the agreed value when there is no discount", () => {
    expect(netAgreedValue(10_541_000n, 0n)).toBe(10_541_000n);
  });

  it("never goes below zero", () => {
    expect(netAgreedValue(100n, 500n)).toBe(0n);
  });
});

describe("settlementDiscountProblem", () => {
  const agreed = 10_541_000n;

  it("accepts letting go of exactly what is left", () => {
    expect(settlementDiscountProblem(agreed, 9_800_000n, 741_000n)).toBeNull();
  });

  it("accepts letting go of part of what is left", () => {
    expect(settlementDiscountProblem(agreed, 9_800_000n, 41_000n)).toBeNull();
  });

  it("refuses zero or a negative figure", () => {
    expect(settlementDiscountProblem(agreed, 0n, 0n)).toMatch(/greater than zero/);
    expect(settlementDiscountProblem(agreed, 0n, -5n)).toMatch(/greater than zero/);
  });

  it("refuses a job with nothing agreed", () => {
    expect(settlementDiscountProblem(0n, 0n, 100n)).toMatch(/no agreed amount/);
  });

  it("refuses letting the whole job go", () => {
    expect(settlementDiscountProblem(agreed, 0n, agreed)).toMatch(/whole agreed amount/);
  });

  it("refuses more than is still to collect", () => {
    expect(settlementDiscountProblem(agreed, 9_800_000n, 741_100n)).toMatch(/more than what is still to collect/);
  });

  it("says so when the job is already paid off", () => {
    expect(settlementDiscountProblem(agreed, agreed, 100n)).toMatch(/Nothing is left/);
  });
});

/** What the lines come to with GST, the way the invoice computes it. */
function billed(lines: { taxable: bigint; gstRate: number }[]): bigint {
  return lines.reduce((s, l) => {
    const t = computeLineTax({
      taxable: l.taxable, gstRate: l.gstRate, supplierStateCode: "33", placeOfSupplyCode: "33",
    });
    return s + l.taxable + t.cgst + t.sgst + t.igst;
  }, 0n);
}

describe("spreadDiscount", () => {
  it("brings mixed-rate lines down by the discount, GST included", () => {
    const lines = [
      { taxable: 5_000_000n, gstRate: 18 },
      { taxable: 3_000_000n, gstRate: 12 },
      { taxable: 1_234_567n, gstRate: 5 },
      { taxable: 800_000n,   gstRate: 0 },
    ];
    const before = billed(lines);
    const after  = spreadDiscount(lines, 741_000n);
    const now    = billed(lines.map((l, i) => ({ ...l, taxable: after[i]! })));
    // Within a few paise of the target — the invoice round-off takes the rest.
    const diff = now - (before - 741_000n);
    expect(diff >= -5n && diff <= 5n).toBe(true);
  });

  it("keeps each line's share of the bill", () => {
    const after = spreadDiscount(
      [{ taxable: 1_000_000n, gstRate: 18 }, { taxable: 1_000_000n, gstRate: 18 }],
      236_000n, // 10 % of the ₹23,600 bill
    );
    expect(after).toEqual([900_000n, 900_000n]);
  });

  it("handles fractional GST rates", () => {
    const after = spreadDiscount([{ taxable: 1_000_000n, gstRate: 2.5 }], 102_500n);
    expect(after).toEqual([900_000n]);
  });

  it("leaves the lines alone when there is no discount", () => {
    const lines = [{ taxable: 12_345n, gstRate: 18 }];
    expect(spreadDiscount(lines, 0n)).toEqual([12_345n]);
    expect(spreadDiscount(lines, -1n)).toEqual([12_345n]);
  });

  it("leaves lines with no value alone", () => {
    expect(spreadDiscount([{ taxable: 0n, gstRate: 18 }], 500n)).toEqual([0n]);
    expect(spreadDiscount([], 500n)).toEqual([]);
  });

  it("zeroes the lines rather than going negative on a discount bigger than the bill", () => {
    expect(spreadDiscount([{ taxable: 100n, gstRate: 0 }], 1_000n)).toEqual([0n]);
  });
});

describe("rateForTaxable", () => {
  /** The server's own arithmetic, from createManualInvoice. */
  function serverTaxable(ratePaise: bigint, quantity: number, discountPct: number): bigint {
    const qtyFixed = BigInt(Math.round(quantity * 10_000));
    const gross    = (ratePaise * qtyFixed) / 10_000n;
    return applyLineDiscount(gross, discountPct).taxable;
  }

  it("gives a rate that bills the target taxable", () => {
    const rate = rateForTaxable(900_000n, 1, 0);
    expect(serverTaxable(rate, 1, 0)).toBe(900_000n);
  });

  it("works through a fractional quantity and a line discount", () => {
    const target = 4_567_891n;
    const rate   = rateForTaxable(target, 2.5, 10);
    const got    = serverTaxable(rate, 2.5, 10);
    const diff   = got - target;
    expect(diff >= -3n && diff <= 3n).toBe(true);
  });

  it("returns zero when there is nothing to bill", () => {
    expect(rateForTaxable(0n, 3, 0)).toBe(0n);
    expect(rateForTaxable(1_000n, 0, 0)).toBe(0n);
    expect(rateForTaxable(1_000n, 1, 100)).toBe(0n);
  });
});
