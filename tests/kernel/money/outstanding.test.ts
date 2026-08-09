import { describe, it, expect } from "vitest";
import { computeOutstanding } from "@/kernel/money/outstanding";

describe("computeOutstanding", () => {
  it("partial allocations — outstanding = total minus advance minus allocs", () => {
    expect(computeOutstanding(100_000n, 20_000n, 30_000n)).toBe(50_000n);
  });

  it("fully paid — outstanding = 0", () => {
    expect(computeOutstanding(100_000n, 0n, 100_000n)).toBe(0n);
  });

  it("over-allocated — clamps to 0n, never negative (line 15 branch)", () => {
    // 20k advance + 90k receipts = 110k > 100k total → out = -10k < 0n → 0n
    expect(computeOutstanding(100_000n, 20_000n, 90_000n)).toBe(0n);
  });
});
