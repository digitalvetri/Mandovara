// Counter-sale arithmetic and validation.
//
// Two things worth pinning without a database:
//
//  1. The totals strip above the sold list. Money is BigInt paise
//     (CLAUDE.md #8) and quantity is a 3-decimal Decimal, so the
//     summing here never touches a float — the bug this guards against
//     is 0.1 + 0.2 arriving as a quantity that is wrong on every row of
//     a long list.
//
//     Scope note: this covers summariseSoldOut only. The stock VALUE
//     write inside recordStockSale still goes through Number() to take
//     cost off at the implied average, exactly as adjustStock has always
//     done — deliberately unchanged, and deliberately not claimed here.
//
//  2. The form schema. What it refuses matters more than what it
//     accepts: a zero or negative quantity would ADD stock through a
//     path called "sold".

import { describe, it, expect } from "vitest";
import {
  summariseSoldOut, type SoldOutRow,
} from "../../../src/modules/inventory/queries-sold";
import { recordStockSaleSchema } from "../../../src/modules/inventory/schema-sold";

function row(over: Partial<SoldOutRow> = {}): SoldOutRow {
  return {
    id:         "m1",
    occurredAt: new Date("2026-09-01"),
    label:      "Marbella Weave — Oyster",
    code:       "MW-OYS",
    dyeLot:     null,
    quantity:   "1",
    sellUnit:   "PIECE",
    ratePaise:  10_000n,      // ₹100.00
    totalPaise: 10_000n,
    soldTo:     null,
    ...over,
  };
}

describe("sold-out totals", () => {
  it("is all zeros with nothing sold", () => {
    const t = summariseSoldOut([]);
    expect(t.saleCount).toBe(0);
    expect(t.unitsSold).toBe("0");
    expect(t.valuePaise).toBe(0n);
  });

  it("adds up counts, units and value", () => {
    const t = summariseSoldOut([
      row({ quantity: "2", totalPaise: 20_000n }),
      row({ id: "m2", quantity: "3", totalPaise: 45_000n }),
    ]);
    expect(t.saleCount).toBe(2);
    expect(t.unitsSold).toBe("5");
    expect(t.valuePaise).toBe(65_000n);
  });

  it("keeps fractional quantities exact — 0.1 + 0.2 is 0.3, not 0.30000000000000004", () => {
    const t = summariseSoldOut([
      row({ quantity: "0.1" }),
      row({ id: "m2", quantity: "0.2" }),
    ]);
    expect(t.unitsSold).toBe("0.3");
  });

  it("sums money as BigInt paise, never a float", () => {
    const t = summariseSoldOut([
      row({ totalPaise: 1n }),
      row({ id: "m2", totalPaise: 2n }),
    ]);
    expect(t.valuePaise).toBe(3n);
    expect(typeof t.valuePaise).toBe("bigint");
  });

  it("counts sales that carried no price", () => {
    const t = summariseSoldOut([row({ ratePaise: 0n, totalPaise: 0n, quantity: "4" })]);
    expect(t.saleCount).toBe(1);
    expect(t.unitsSold).toBe("4");
    expect(t.valuePaise).toBe(0n);
  });
});

describe("sale form validation", () => {
  const base = {
    colourwayId: "c".repeat(25),
    quantity:    2,
    soldOn:      "2026-09-04",
  };

  it("accepts the minimum a sale needs", () => {
    expect(recordStockSaleSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a zero quantity — that is not a sale", () => {
    expect(recordStockSaleSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
  });

  it("refuses a negative quantity, which would ADD stock", () => {
    expect(recordStockSaleSchema.safeParse({ ...base, quantity: -5 }).success).toBe(false);
  });

  it("refuses a date that isn't a date", () => {
    expect(recordStockSaleSchema.safeParse({ ...base, soldOn: "yesterday" }).success).toBe(false);
  });

  it("refuses an id too short to be a cuid", () => {
    expect(recordStockSaleSchema.safeParse({ ...base, colourwayId: "abc" }).success).toBe(false);
  });

  it("takes the optional fields — lot, price, buyer, note", () => {
    const r = recordStockSaleSchema.safeParse({
      ...base,
      dyeLot: "LOT-22B",
      rate:   "1,200.50",
      soldTo: "Mrs Iyer",
      note:   "Walk-in, cash counter",
    });
    expect(r.success).toBe(true);
  });

  it("treats blank optionals as absent rather than invalid", () => {
    const r = recordStockSaleSchema.safeParse({
      ...base, dyeLot: "", rate: "", soldTo: "", note: "",
    });
    expect(r.success).toBe(true);
  });

  it("leaves the rate as a string for parseINR — no float parsing here", () => {
    const r = recordStockSaleSchema.safeParse({ ...base, rate: "1200.50" });
    expect(r.success).toBe(true);
    if (r.success) expect(typeof r.data.rate).toBe("string");
  });
});
