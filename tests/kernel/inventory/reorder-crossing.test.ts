// Pure predicate for the low-stock crossing helper. Covers the exact
// boundary conditions called out by the advisor so the semantics stay
// pinned across future refactors.

import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { computeCrossing } from "@/kernel/inventory/reorder";

const d = (n: number) => new Decimal(n);

describe("computeCrossing", () => {
  it("crosses when the issue drops on-hand below the reorder line", () => {
    // prev = 15, delta = −5, reorder = 12 → crosses
    const c = computeCrossing(d(10), d(-5), d(12));
    expect(c.crossedThreshold).toBe(true);
    expect(c.currentQty).toBe("10");
    expect(c.reorderLevel).toBe("12");
  });

  it("does NOT cross when the SKU was already at threshold", () => {
    // prev = 12, delta = −2, reorder = 12 → already at line, not a fresh trip
    const c = computeCrossing(d(10), d(-2), d(12));
    expect(c.crossedThreshold).toBe(false);
  });

  it("does NOT cross when the SKU was already below threshold", () => {
    // prev = 10, delta = −1, reorder = 12 → below already, not a fresh trip
    const c = computeCrossing(d(9), d(-1), d(12));
    expect(c.crossedThreshold).toBe(false);
  });

  it("does NOT cross when reorder level is unset", () => {
    const c = computeCrossing(d(0), d(-5), null);
    expect(c.crossedThreshold).toBe(false);
    expect(c.reorderLevel).toBeNull();
  });

  it("does NOT cross on inward movement", () => {
    // prev = 5, delta = +10, reorder = 12 → gaining stock, ignored
    const c = computeCrossing(d(15), d(10), d(12));
    expect(c.crossedThreshold).toBe(false);
  });

  it("crosses exactly onto the threshold (currentQty == reorder)", () => {
    // prev = 15, delta = −3, reorder = 12 → lands on 12, that IS a trip
    const c = computeCrossing(d(12), d(-3), d(12));
    expect(c.crossedThreshold).toBe(true);
  });

  it("handles adjustStock semantics (positive delta = inward)", () => {
    // adjustStock passes deltaDec directly. A −5 adjustment from 15 lands at 10.
    const c = computeCrossing(d(10), d(-5), d(12));
    expect(c.crossedThreshold).toBe(true);
  });

  it("handles issueStock semantics (quantity.negated() = outward)", () => {
    // issueStock passes quantity.negated(). Issuing 5 from 15 lands at 10.
    const issueQty = d(5);
    const c = computeCrossing(d(10), issueQty.negated(), d(12));
    expect(c.crossedThreshold).toBe(true);
  });

  it("keeps decimal precision (metric units)", () => {
    // Curtain fabric: prev 12.5m, issue 0.7m → 11.8m, reorder 12.0
    const c = computeCrossing(new Decimal("11.8"), new Decimal("-0.7"), new Decimal("12"));
    expect(c.crossedThreshold).toBe(true);
    expect(c.currentQty).toBe("11.8");
  });
});
