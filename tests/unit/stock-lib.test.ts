// Pure unit tests for src/modules/stock/lib.ts — no DB required.
//
// The mixed-lot cases that used to live here went with the dye-lot allocation
// console; what remains are the two stock primitives that outlived it.

import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { availableQty, qtyPaise } from "@/modules/stock/lib";

// ── availableQty ──────────────────────────────────────────────────────────────

describe("availableQty", () => {
  it("returns quantity minus reserved", () => {
    const result = availableQty({
      quantity: new Decimal("10.500"),
      reserved: new Decimal("3.000"),
    });
    expect(result.toString()).toBe("7.5");
  });

  it("returns zero when fully reserved", () => {
    const result = availableQty({
      quantity: new Decimal("10"),
      reserved: new Decimal("10"),
    });
    expect(result.toNumber()).toBe(0);
  });

  it("handles decimal quantities precisely", () => {
    const result = availableQty({
      quantity: new Decimal("10.050"),
      reserved: new Decimal("3.750"),
    });
    expect(result.toString()).toBe("6.3");
  });
});

// ── qtyPaise ──────────────────────────────────────────────────────────────────

describe("qtyPaise", () => {
  it("computes 10.05m × ₹500/m = 5025 paise correctly", () => {
    // ₹500/m = 50 000 paise/m; 10.05m × 50 000 = 502 500 paise
    expect(qtyPaise(new Decimal("10.05"), 50_000n)).toBe(502_500n);
  });

  it("computes whole quantities without error", () => {
    // 5m × ₹200/m = 1000 paise = ₹10
    expect(qtyPaise(new Decimal("5"), 20_000n)).toBe(100_000n);
  });

  it("handles sub-rupee precision", () => {
    // 1.001m × ₹1000/m = ₹1001 = 100 100 paise
    expect(qtyPaise(new Decimal("1.001"), 100_000n)).toBe(100_100n);
  });

  it("handles very small rates", () => {
    // 3 sqft × 1 paise/sqft = 3 paise
    expect(qtyPaise(new Decimal("3"), 1n)).toBe(3n);
  });

  it("handles zero quantity", () => {
    expect(qtyPaise(new Decimal("0"), 50_000n)).toBe(0n);
  });
});

