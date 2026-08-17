// Ensures the plain-language dictionary itself is well-formed and the
// snapshot helper catches every banned term.
// The rendered-HTML snapshot check that scans real accounts pages lives
// in tests/e2e (Phase 2), because it needs a real browser to see the
// composed text after React tree renders.

import { describe, it, expect } from "vitest";
import { BANNED_TERMS, BANNED_TO_PLAIN, findBannedTerms } from "../../src/kernel/copy/accounts-lexicon";

describe("accounts-lexicon", () => {
  it("every banned term has a non-empty replacement or is an intentional silence", () => {
    for (const term of BANNED_TERMS) {
      const replacement = BANNED_TO_PLAIN[term as keyof typeof BANNED_TO_PLAIN];
      // Empty string is fine — signals "no replacement, just don't say this".
      // But an *undefined* replacement means the map is broken.
      expect(replacement).toBeDefined();
    }
  });

  it("findBannedTerms matches a plain hit", () => {
    expect(findBannedTerms("Total accounts receivable: ₹8,42,000")).toContain("accounts receivable");
  });

  it("findBannedTerms is case-insensitive", () => {
    expect(findBannedTerms("Ageing bucket 60+")).toContain("ageing bucket");
    expect(findBannedTerms("DEBTORS")).toContain("debtors");
  });

  it("findBannedTerms uses word boundaries — 'credit' does not match inside 'credited'", () => {
    expect(findBannedTerms("Amount credited to your account")).not.toContain("credit");
  });

  it("findBannedTerms does not match inside compound words", () => {
    // 'creditcard' should not trigger the 'credit' rule
    expect(findBannedTerms("creditcard payment")).not.toContain("credit");
  });

  it("clean plain-English copy returns no hits", () => {
    const sample = "To collect ₹8,42,000 — ₹2,10,000 is 60+ days late. History available.";
    expect(findBannedTerms(sample)).toEqual([]);
  });
});
