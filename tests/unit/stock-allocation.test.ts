// Pure unit tests for src/modules/stock/lib.ts — no DB required.
// These run as part of the standard Vitest suite.

import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  availableQty,
  detectMixedLot,
  qtyPaise,
  MixedLotError,
  InsufficientStockError,
} from "@/modules/stock/lib";

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

// ── detectMixedLot ────────────────────────────────────────────────────────────

describe("detectMixedLot", () => {
  it("returns false when no existing allocations", () => {
    expect(detectMixedLot([], "LOT-001")).toBe(false);
    expect(detectMixedLot([], null)).toBe(false);
  });

  it("returns false when incoming lot matches the existing lot", () => {
    expect(detectMixedLot(["LOT-001"], "LOT-001")).toBe(false);
  });

  it("returns true when incoming lot differs from existing lot", () => {
    expect(detectMixedLot(["LOT-001"], "LOT-002")).toBe(true);
  });

  it("null == null: no conflict", () => {
    expect(detectMixedLot([null], null)).toBe(false);
  });

  it("null vs non-null: mixed lot conflict", () => {
    expect(detectMixedLot([null], "LOT-001")).toBe(true);
    expect(detectMixedLot(["LOT-001"], null)).toBe(true);
  });

  it("uses the first existing lot as the reference", () => {
    // The gate checks [first] against incoming — single lot per order line is the rule
    expect(detectMixedLot(["LOT-001", "LOT-001"], "LOT-001")).toBe(false);
    expect(detectMixedLot(["LOT-001", "LOT-001"], "LOT-002")).toBe(true);
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

// ── Error classes ─────────────────────────────────────────────────────────────

describe("MixedLotError", () => {
  it("has correct name and mentions both lots", () => {
    const e = new MixedLotError("line-abc", "LOT-001", "LOT-002");
    expect(e.name).toBe("MixedLotError");
    expect(e.message).toContain("LOT-001");
    expect(e.message).toContain("LOT-002");
    expect(e instanceof MixedLotError).toBe(true);
    expect(e instanceof Error).toBe(true);
  });

  it("renders null lots readably", () => {
    const e = new MixedLotError("line-xyz", null, "LOT-002");
    expect(e.message).toContain("(none)");
    expect(e.message).toContain("LOT-002");
  });
});

describe("InsufficientStockError", () => {
  it("has correct name and mentions colourway and quantities", () => {
    const e = new InsufficientStockError(
      "cw-id-123",
      "LOT-001",
      new Decimal("10"),
      new Decimal("3"),
    );
    expect(e.name).toBe("InsufficientStockError");
    expect(e.message).toContain("cw-id-123");
    expect(e.message).toContain("LOT-001");
    expect(e instanceof InsufficientStockError).toBe(true);
  });

  it("handles null lot", () => {
    const e = new InsufficientStockError("cw-id-456", null, new Decimal("5"), new Decimal("0"));
    expect(e.message).toContain("(none)");
  });
});
