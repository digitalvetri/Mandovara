import { describe, it, expect } from "vitest";
import { moveItem } from "@/lib/move-item";

describe("moveItem", () => {
  const list = ["a", "b", "c", "d"] as const;

  it("moves a newly added last line up to the top", () => {
    expect(moveItem(list, 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("moves a line down into the middle", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("swaps neighbours for a single step", () => {
    expect(moveItem(list, 1, 2)).toEqual(["a", "c", "b", "d"]);
    expect(moveItem(list, 2, 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("does not mutate the input", () => {
    const src = ["a", "b", "c"];
    moveItem(src, 0, 2);
    expect(src).toEqual(["a", "b", "c"]);
  });

  it("returns the same reference for a no-op or out-of-range move", () => {
    expect(moveItem(list, 1, 1)).toBe(list);
    expect(moveItem(list, -1, 2)).toBe(list);
    expect(moveItem(list, 0, 4)).toBe(list);
    expect(moveItem(list, 4, 0)).toBe(list);
  });
});
