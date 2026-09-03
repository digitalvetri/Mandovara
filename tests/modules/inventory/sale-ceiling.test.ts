// How much may be sold over the counter.
//
// The case that matters most is the one a code review caught before it
// shipped: the sell form offers a dye-lot dropdown, and the first
// version dropped the reservation check the moment a lot was chosen. A
// SKU with 20m on one lot and 15m promised to a confirmed order would
// have sold all 20m and stranded the order.
//
// The rule is two ceilings — the shelf and the promise — and a sale has
// to clear both.

import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { saleCeiling, type LotBalance } from "../../../src/modules/inventory/sold-availability";

const lots = (...rows: [string | null, string][]): LotBalance[] =>
  rows.map(([dyeLot, quantity]) => ({ dyeLot, quantity }));

const n = (d: Decimal) => d.toString();

describe("whole-SKU sales", () => {
  it("offers everything on hand when nothing is committed", () => {
    const c = saleCeiling(lots([null, "20"]), null, 0);
    expect(n(c.available)).toBe("20");
    expect(c.blockedByCommitment).toBe(false);
  });

  it("takes live quotes and orders off the top", () => {
    const c = saleCeiling(lots([null, "20"]), null, 15);
    expect(n(c.available)).toBe("5");
    expect(c.blockedByCommitment).toBe(true);
  });

  it("sums across every lot", () => {
    const c = saleCeiling(lots(["A", "8"], ["B", "12"]), null, 0);
    expect(n(c.totalOnHand)).toBe("20");
    expect(n(c.available)).toBe("20");
  });

  it("floors at zero when more is committed than exists", () => {
    const c = saleCeiling(lots([null, "5"]), null, 9);
    expect(n(c.available)).toBe("0");
  });

  it("offers nothing when there is no stock row at all", () => {
    expect(n(saleCeiling([], null, 0).available)).toBe("0");
  });
});

describe("dye-lot sales — the hole the review caught", () => {
  it("does NOT let a lot sale walk past a commitment", () => {
    // 20m, all on one lot, 15m promised to a confirmed order.
    // Choosing the lot must not unlock the promised 15m.
    const c = saleCeiling(lots(["A", "20"]), "A", 15);
    expect(n(c.available)).toBe("5");
    expect(c.blockedByCommitment).toBe(true);
  });

  it("still allows the sales a studio can genuinely make", () => {
    // 20m across two lots, 12m committed → 8m spare SKU-wide. Lot B
    // holds 12m, so it can give up the full 8m; the commitment binds,
    // not the shelf.
    const c = saleCeiling(lots(["A", "8"], ["B", "12"]), "B", 12);
    expect(n(c.available)).toBe("8");
  });

  it("is bounded by the lot when the lot is the smaller ceiling", () => {
    // 20m across two lots, nothing committed, but lot A only holds 8m.
    const c = saleCeiling(lots(["A", "8"], ["B", "12"]), "A", 0);
    expect(n(c.available)).toBe("8");
    expect(c.blockedByCommitment).toBe(false);
  });

  it("blames the shelf, not a commitment, when the lot is the tighter limit", () => {
    // 6m committed of 20m → 14m spare SKU-wide, but lot A holds 8m.
    const c = saleCeiling(lots(["A", "8"], ["B", "12"]), "A", 6);
    expect(n(c.available)).toBe("8");
    expect(c.blockedByCommitment).toBe(false);
  });

  it("offers nothing from a lot that is empty", () => {
    const c = saleCeiling(lots(["A", "0"], ["B", "12"]), "A", 0);
    expect(n(c.available)).toBe("0");
  });

  it("offers nothing from a lot that does not exist", () => {
    expect(n(saleCeiling(lots(["A", "8"]), "GHOST", 0).available)).toBe("0");
  });

  it("never counts another lot's stock toward this one", () => {
    const c = saleCeiling(lots(["A", "3"], ["B", "50"]), "A", 0);
    expect(n(c.available)).toBe("3");
    expect(n(c.onHand)).toBe("3");
    expect(n(c.totalOnHand)).toBe("53");
  });
});

describe("fractional quantities stay exact", () => {
  it("adds lots without float drift", () => {
    const c = saleCeiling(lots(["A", "0.1"], ["B", "0.2"]), null, 0);
    expect(n(c.totalOnHand)).toBe("0.3");
  });

  it("keeps three decimals through the subtraction", () => {
    const c = saleCeiling(lots([null, "10.125"]), null, 0.125);
    expect(n(c.available)).toBe("10");
  });
});

describe("which sentence the operator is shown", () => {
  it("does not blame a commitment when nothing is committed", () => {
    // available === skuUncommitted here too, but reserved is 0 — the
    // shelf is the honest reason.
    expect(saleCeiling(lots([null, "4"]), null, 0).blockedByCommitment).toBe(false);
  });

  it("blames the commitment when that is what bound the number", () => {
    expect(saleCeiling(lots([null, "4"]), null, 1).blockedByCommitment).toBe(true);
  });
});
