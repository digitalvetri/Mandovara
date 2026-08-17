// Chase-score boundary tests — one per knob in the algorithm.
// Every boundary listed in docs/ACCOUNTS-PAGE.md §6.1 must have a
// day-before / day-of / day-after assertion.

import { describe, it, expect } from "vitest";
import {
  chaseScore, DAYS_LATE_TIERS, CONTACT_PENALTIES,
  type ChaseInput,
} from "../../src/modules/accounts/chase";

const NOW = new Date("2026-08-17T09:00:00Z");
const rupees = (r: number): bigint => BigInt(r * 100);   // rupees → paise

// Days-ago helper — anchored at NOW.
function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}
function daysAhead(n: number): Date {
  return daysAgo(-n);
}

function baseInput(overrides: Partial<ChaseInput> = {}): ChaseInput {
  return {
    clientId:          "c1",
    clientName:        "Test Client",
    clientMobile:      "+91 9000000000",
    outstanding:       rupees(100_000),
    oldestDueDate:     daysAgo(45),           // in the 31–60 tier by default
    doNotChase:        false,
    lastContactedAt:   daysAgo(10),           // in the "older than 7" penalty
    activePromiseDate: null,
    disputed:          false,
    ...overrides,
  };
}

describe("chaseScore — suppression rules", () => {
  it("hides when outstanding is zero", () => {
    expect(chaseScore(baseInput({ outstanding: 0n }), NOW)).toBeNull();
  });

  it("hides when the client is flagged doNotChase", () => {
    expect(chaseScore(baseInput({ doNotChase: true }), NOW)).toBeNull();
  });

  it("hides when the invoice is disputed", () => {
    expect(chaseScore(baseInput({ disputed: true }), NOW)).toBeNull();
  });

  it("hides when a promise-to-pay date is still in the future", () => {
    expect(chaseScore(baseInput({ activePromiseDate: daysAhead(1) }), NOW)).toBeNull();
  });

  it("hides when contacted today", () => {
    expect(chaseScore(baseInput({ lastContactedAt: NOW }), NOW)).toBeNull();
  });

  it("re-surfaces when a promise date has passed (yesterday)", () => {
    const score = chaseScore(baseInput({ activePromiseDate: daysAgo(1) }), NOW);
    expect(score).toBeGreaterThan(0);
  });

  it("re-surfaces when the promise date is today (not future — suppression is strict >0)", () => {
    const score = chaseScore(baseInput({ activePromiseDate: NOW }), NOW);
    expect(score).toBeGreaterThan(0);
  });
});

describe("chaseScore — days-late tier boundaries", () => {
  // Every tier boundary the spec lists: 15/16, 30/31, 60/61, 90/91.
  const cases: Array<{ daysLate: number; expectedWeight: number; label: string }> = [
    { daysLate: 0,   expectedWeight: 0.5, label: "day 0 (just due today)" },
    { daysLate: 15,  expectedWeight: 0.5, label: "day 15 (still in 0–15 tier)" },
    { daysLate: 16,  expectedWeight: 1.0, label: "day 16 (crosses into 16–30)" },
    { daysLate: 30,  expectedWeight: 1.0, label: "day 30 (still in 16–30)" },
    { daysLate: 31,  expectedWeight: 2.0, label: "day 31 (crosses into 31–60)" },
    { daysLate: 60,  expectedWeight: 2.0, label: "day 60 (still in 31–60)" },
    { daysLate: 61,  expectedWeight: 3.5, label: "day 61 (crosses into 61–90)" },
    { daysLate: 90,  expectedWeight: 3.5, label: "day 90 (still in 61–90)" },
    { daysLate: 91,  expectedWeight: 5.0, label: "day 91 (crosses into 90+)" },
    { daysLate: 365, expectedWeight: 5.0, label: "day 365 (still in 90+)" },
  ];

  for (const c of cases) {
    it(`weight ${c.expectedWeight}× at ${c.label}`, () => {
      const input = baseInput({
        oldestDueDate:   daysAgo(c.daysLate),
        outstanding:     rupees(100_000),
        lastContactedAt: daysAgo(10),   // penalty 1.5 (older tier)
      });
      const score = chaseScore(input, NOW);
      // 100_000 rupees × weight × 1.5
      expect(score).toBeCloseTo(100_000 * c.expectedWeight * 1.5, 6);
    });
  }
});

describe("chaseScore — contact-penalty tiers", () => {
  // Boundaries: 0 (today) = suppressed; 1 = within 2; 2 = within 2;
  // 3 = within 7; 7 = within 7; 8 = older.
  const cases: Array<{ daysAgo: number; expectedPenalty: number | null; label: string }> = [
    { daysAgo: 0, expectedPenalty: null,                            label: "today (suppressed)" },
    { daysAgo: 1, expectedPenalty: CONTACT_PENALTIES.within2Days,   label: "1 day ago (within 2)" },
    { daysAgo: 2, expectedPenalty: CONTACT_PENALTIES.within2Days,   label: "2 days ago (within 2)" },
    { daysAgo: 3, expectedPenalty: CONTACT_PENALTIES.within7Days,   label: "3 days ago (within 7)" },
    { daysAgo: 7, expectedPenalty: CONTACT_PENALTIES.within7Days,   label: "7 days ago (within 7)" },
    { daysAgo: 8, expectedPenalty: CONTACT_PENALTIES.older,         label: "8 days ago (older)" },
  ];

  for (const c of cases) {
    it(`penalty at ${c.label}`, () => {
      const input = baseInput({
        oldestDueDate:   daysAgo(45),          // weight 2.0
        outstanding:     rupees(100_000),
        lastContactedAt: daysAgo(c.daysAgo),
      });
      const score = chaseScore(input, NOW);
      if (c.expectedPenalty == null) {
        expect(score).toBeNull();
      } else {
        expect(score).toBeCloseTo(100_000 * 2.0 * c.expectedPenalty, 6);
      }
    });
  }

  it("never-contacted uses the older-tier penalty (1.5)", () => {
    const input = baseInput({
      oldestDueDate:   daysAgo(45),
      outstanding:     rupees(100_000),
      lastContactedAt: null,
    });
    expect(chaseScore(input, NOW)).toBeCloseTo(100_000 * 2.0 * 1.5, 6);
  });
});

describe("chaseScore — ranking", () => {
  it("ranks by amount × tier × penalty (bigger score wins)", () => {
    // Client A: 1L, 45d late (×2.0), 10d since contact (×1.5) → 300,000
    const a = chaseScore(baseInput({
      clientId: "A", outstanding: rupees(100_000),
      oldestDueDate: daysAgo(45), lastContactedAt: daysAgo(10),
    }), NOW)!;
    // Client B: 50k, 91d late (×5.0), 10d since contact (×1.5) → 375,000
    const b = chaseScore(baseInput({
      clientId: "B", outstanding: rupees(50_000),
      oldestDueDate: daysAgo(91), lastContactedAt: daysAgo(10),
    }), NOW)!;
    // Even though B owes half of A, the higher tier + same penalty
    // pushes B ahead.
    expect(b).toBeGreaterThan(a);
  });
});

describe("DAYS_LATE_TIERS invariants", () => {
  it("tiers are contiguous with no overlap or gap", () => {
    for (let i = 1; i < DAYS_LATE_TIERS.length; i++) {
      expect(DAYS_LATE_TIERS[i]!.min).toBe(DAYS_LATE_TIERS[i - 1]!.max + 1);
    }
  });
  it("tier weights are strictly increasing", () => {
    for (let i = 1; i < DAYS_LATE_TIERS.length; i++) {
      expect(DAYS_LATE_TIERS[i]!.weight).toBeGreaterThan(DAYS_LATE_TIERS[i - 1]!.weight);
    }
  });
});
