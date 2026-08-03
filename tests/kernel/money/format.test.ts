import { describe, expect, it } from "vitest";
import { formatINR, formatINRPlain, parseINR, ParseError } from "@/kernel/money/format";

describe("formatINR — the KIT-mandated set", () => {
  it("1 paise → ₹0.01", () => {
    expect(formatINR(1n)).toBe("₹0.01");
  });
  it("100 paise → ₹1", () => {
    expect(formatINR(100n)).toBe("₹1");
  });
  it("99999 paise → ₹999.99", () => {
    expect(formatINR(99999n)).toBe("₹999.99");
  });
  it("100000 paise → ₹1,000", () => {
    expect(formatINR(100_000n)).toBe("₹1,000");
  });
  it("1650000 paise → ₹16,500", () => {
    expect(formatINR(1_650_000n)).toBe("₹16,500");
  });
  it("10000000 paise → ₹1,00,000", () => {
    expect(formatINR(10_000_000n)).toBe("₹1,00,000");
  });
  it("100000000 paise → ₹10,00,000", () => {
    expect(formatINR(100_000_000n)).toBe("₹10,00,000");
  });
  it("1 crore rupees (10^9 paise) → ₹1,00,00,000", () => {
    expect(formatINR(1_000_000_000n)).toBe("₹1,00,00,000");
  });
  it("10 crore rupees (10^10 paise) → ₹10,00,00,000", () => {
    expect(formatINR(10_000_000_000n)).toBe("₹10,00,00,000");
  });
  it("negative → parenthesised", () => {
    expect(formatINR(-1_00_000n)).toBe("(₹1,000)");
  });
  it("zero → ₹0", () => {
    expect(formatINR(0n)).toBe("₹0");
  });
});

describe("formatINRPlain", () => {
  it("strips ₹", () => {
    expect(formatINRPlain(1_650_000n)).toBe("16,500");
  });
  it("strips parentheses on negatives", () => {
    expect(formatINRPlain(-1_00_000n)).toBe("1,000");
  });
});

describe("parseINR — every accepted format round-trips", () => {
  // All expected values are in paise (rupees × 100).
  const cases: [string | number, bigint][] = [
    // 1,650,000 rupees × 100 = 165,000,000 paise
    ["1650000",     165_000_000n],
    ["16,50,000",   165_000_000n],
    ["1,650,000",   165_000_000n],
    ["16.5L",       165_000_000n],
    ["16.5 lakh",   165_000_000n],
    ["16.5 lakhs",  165_000_000n],
    // 15,000,000 rupees × 100 = 1,500,000,000 paise
    ["1.5cr",       1_500_000_000n],
    ["1.5 crore",   1_500_000_000n],
    ["1.5 crores",  1_500_000_000n],
    // 500,000 rupees × 100 = 50,000,000 paise
    ["500k",        50_000_000n],
    // 16.50 rupees × 100 = 1650 paise
    ["16.50",       1650n],
    // 100,000 rupees × 100 = 10,000,000 paise
    ["₹1,00,000",   10_000_000n],
    // 500 rupees × 100 = 50,000 paise
    ["Rs 500",      50_000n],
    ["Rs. 500",     50_000n],
    ["INR 500",     50_000n],
    ["(500)",      -50_000n],
    ["-500",       -50_000n],
    // Numeric input is treated as rupees per the docstring.
    [1_650_000,     165_000_000n],
    [0,             0n],
  ];
  for (const [input, expected] of cases) {
    it(`parseINR(${JSON.stringify(input)}) → ${expected}n`, () => {
      expect(parseINR(input)).toBe(expected);
    });
  }
});

describe("parseINR — failures", () => {
  it("empty string throws", () => {
    expect(() => parseINR("")).toThrow(ParseError);
  });
  it("garbage throws", () => {
    expect(() => parseINR("abc")).toThrow(ParseError);
  });
  it("Infinity throws", () => {
    expect(() => parseINR(Infinity)).toThrow(/not finite/);
  });
  it("NaN throws", () => {
    expect(() => parseINR(NaN)).toThrow(/not finite/);
  });
});
