import { describe, it, expect } from "vitest";
import { formatINR, formatINRShort } from "@/kernel/money/format";
describe("formatINRShort", () => {
  it("groups Indian style below a lakh", () => {
    expect(formatINRShort(1_650_000n)).toBe("₹16,500");
    expect(formatINRShort(10_000n)).toBe("₹100");
  });
  it("abbreviates lakhs and crores", () => {
    expect(formatINRShort(45_000_000n)).toBe("₹4.5 L");
    expect(formatINRShort(120_000_000_0n)).toBe("₹1.2 Cr");
  });
  it("zero and negatives", () => {
    expect(formatINRShort(0n)).toBe("₹0");
    expect(formatINRShort(-1_650_000n)).toBe("(₹16,500)");
  });
  it("agrees with formatINR on whole rupees below a lakh", () => {
    expect(formatINRShort(9_999_900n)).toBe(formatINR(9_999_900n));
  });
});
