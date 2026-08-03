import { describe, expect, it } from "vitest";

describe("scaffold smoke", () => {
  it("runs a passing test so the suite is not empty", () => {
    expect(1 + 1).toBe(2);
  });
});
