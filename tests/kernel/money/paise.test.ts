import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  abs, add, multiplyByQuantity, paise, percentage,
  roundHalfUpDivide, roundToRupee, rupees, subtract,
} from "@/kernel/money/paise";

describe("rupees()", () => {
  it("converts a whole number of rupees to paise", () => {
    expect(rupees(100)).toBe(10_000n);
  });
  it("rounds half-up on fractional rupees", () => {
    expect(rupees(0.005)).toBe(1n);        // 0.5 paise → 1
    expect(rupees(1.995)).toBe(200n);      // 199.5 paise → 200
  });
  it("accepts a comma-formatted string", () => {
    expect(rupees("1,650.50")).toBe(1_65_050n);
  });
  it("throws on a non-finite number", () => {
    expect(() => rupees(Infinity)).toThrow(/finite/);
    expect(() => rupees(NaN)).toThrow(/finite/);
  });
  it("throws on a garbage string", () => {
    expect(() => rupees("₹100")).toThrow(/rupee-formatted/);
    expect(() => rupees("abc")).toThrow(/rupee-formatted/);
  });
});

describe("paise()", () => {
  it("passes bigint through", () => { expect(paise(42n)).toBe(42n); });
  it("accepts an integer number", () => { expect(paise(42)).toBe(42n); });
  it("throws on a non-integer number", () => {
    expect(() => paise(1.5)).toThrow(/integer/);
  });
  it("accepts a numeric string", () => { expect(paise("100")).toBe(100n); });
});

describe("add / subtract", () => {
  it("adds zero args → 0n", () => { expect(add()).toBe(0n); });
  it("adds many values exactly", () => {
    expect(add(1n, 2n, 3n, 4n, 5n)).toBe(15n);
  });
  it("subtracts", () => {
    expect(subtract(100n, 40n)).toBe(60n);
    expect(subtract(40n, 100n)).toBe(-60n);
  });
});

describe("multiplyByQuantity", () => {
  it("Decimal-typed integer qty", () => {
    expect(multiplyByQuantity(100_00n, new Prisma.Decimal(5))).toBe(500_00n);
  });
  it("Decimal with 2 fractional digits", () => {
    // ₹100 per unit × 2.50 units = ₹250
    expect(multiplyByQuantity(100_00n, new Prisma.Decimal("2.50"))).toBe(250_00n);
  });
  it("Decimal at scale 4 (kg with 4 dp)", () => {
    // ₹123.45 per kg × 3.1234 kg = ₹385.51...
    // 12345 * 31234 / 10000 = 38558.313 → round-half-up = 38558
    const result = multiplyByQuantity(12345n, new Prisma.Decimal("3.1234"));
    expect(result).toBe(38558n);
  });
  it("string quantity", () => {
    expect(multiplyByQuantity(10_00n, "3.5")).toBe(35_00n);
  });
  it("number quantity", () => {
    expect(multiplyByQuantity(10_00n, 3.5)).toBe(35_00n);
  });
  it("negative quantity", () => {
    // −3 × ₹10 = −₹30 = -3000n paise
    expect(multiplyByQuantity(10_00n, "-3")).toBe(-30_00n);
  });
  it("throws on malformed quantity", () => {
    expect(() => multiplyByQuantity(10_00n, "abc")).toThrow(/bad quantity/);
  });
});

describe("percentage", () => {
  it("18 % of ₹10,000 = ₹1,800", () => {
    expect(percentage(10_000_00n, 18)).toBe(1_800_00n);
  });
  it("half rate 9 %", () => {
    expect(percentage(10_000_00n, 9)).toBe(900_00n);
  });
  it("12.5 % fractional rate (basis points)", () => {
    expect(percentage(100_00n, 12.5)).toBe(12_50n);
  });
  it("rounds half-up on fractional paisa", () => {
    // 100 paise * 3 % = 3 paise exact
    expect(percentage(100n, 3)).toBe(3n);
    // 101 paise * 3.5 % = 3.535 paise → round-half-up = 4
    expect(percentage(101n, 3.5)).toBe(4n);
  });
  it("0 % → 0", () => {
    expect(percentage(1_00_000n, 0)).toBe(0n);
  });
});

describe("roundToRupee", () => {
  it("no rounding needed", () => {
    const r = roundToRupee(1_00_000n);
    expect(r.rounded).toBe(1_00_000n);
    expect(r.adjustment).toBe(0n);
  });
  it("rounds up ≥50 paise", () => {
    const r = roundToRupee(1_00_050n);
    expect(r.rounded).toBe(1_00_100n);
    expect(r.adjustment).toBe(50n);
  });
  it("rounds down <50 paise", () => {
    const r = roundToRupee(1_00_049n);
    expect(r.rounded).toBe(1_00_000n);
    expect(r.adjustment).toBe(-49n);
  });
  it("exact 0.50 rounds up (half-up)", () => {
    const r = roundToRupee(1_18_050n);
    expect(r.rounded).toBe(1_18_100n);
    expect(r.adjustment).toBe(50n);
  });
});

describe("roundHalfUpDivide", () => {
  it("positive rounding", () => {
    expect(roundHalfUpDivide(7n, 2n)).toBe(4n);      // 3.5 → 4
    expect(roundHalfUpDivide(5n, 2n)).toBe(3n);      // 2.5 → 3
    expect(roundHalfUpDivide(1n, 3n)).toBe(0n);      // 0.33 → 0
    expect(roundHalfUpDivide(2n, 3n)).toBe(1n);      // 0.66 → 1
  });
  it("negative rounding rounds away from zero at .5", () => {
    expect(roundHalfUpDivide(-7n, 2n)).toBe(-4n);
    expect(roundHalfUpDivide(-1n, 3n)).toBe(0n);
  });
  it("throws on non-positive denominator", () => {
    expect(() => roundHalfUpDivide(1n, 0n)).toThrow(/positive/);
    expect(() => roundHalfUpDivide(1n, -1n)).toThrow(/positive/);
  });
});

describe("abs", () => {
  it("preserves positive", () => { expect(abs(5n)).toBe(5n); });
  it("flips negative", () => { expect(abs(-5n)).toBe(5n); });
  it("zero → zero", () => { expect(abs(0n)).toBe(0n); });
});
