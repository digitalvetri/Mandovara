// Plain-language dictionary for the Accounts & Payments surface.
// Enforced by tests/unit/accounts/banned-words.test.ts — if any of the
// banned terms appears in the rendered HTML of any accounts view, that
// test fails.
//
// See docs/ACCOUNTS-PAGE.md §3 for the source table and the reasoning.
// If new accounting jargon slips in, add it here first, then rename it.

/** Terms that must NEVER appear in any accounts UI, mapped to the plain-
 *  English replacement the UI should use. */
export const BANNED_TO_PLAIN = {
  // Balance-sheet language
  "accounts receivable": "To collect",
  "accounts payable":    "To pay",
  "receivables":         "Money owed to you",
  "payables":            "To pay",
  "debtors":             "Money owed to you",
  "creditors":           "To pay",

  // Ageing
  "ageing":              "How long they've owed",
  "ageing bucket":       "How long they've owed",
  "aging":               "How long they've owed",
  "aging bucket":        "How long they've owed",

  // Allocation / reconciliation
  "allocation":          "Which bills this payment covers",
  "unallocated":         "Extra amount kept for later bills",
  "on account":          "Extra amount kept for later bills",
  "reconciliation":      "Matching payments to bills",

  // Credit / debit / ledger
  "credit note":         "Amount returned to client",
  "credit memo":         "Amount returned to client",
  "debit note":          "Amount charged extra",
  "debit":               "",   // never appears
  "credit":              "",   // never appears (as a noun in accounts context)
  "ledger":              "History",

  // Days-late phrasing
  "overdue by":          "N days late",
  "days overdue":        "days late",

  // Advance vs money-taken-early
  "advance":             "Money taken before work started",
} as const;

/** Just the banned strings — used by the snapshot test. */
export const BANNED_TERMS: readonly string[] = Object.keys(BANNED_TO_PLAIN)
  // Empty string keys are placeholders; skip them for matching.
  .filter((k) => k.length > 0);

/** Preferred-copy strings the UI should reach for. Kept close to the
 *  banned map so they don't drift out of sync. */
export const PREFERRED_COPY = {
  toCollect:                   "To collect",
  toPay:                       "To pay",
  moneyOwedToYou:              "Money owed to you",
  howLongOwed:                 "How long they've owed",
  whichBillsThisPaymentCovers: "Which bills this payment covers",
  extraKeptForLaterBills:      "Extra kept for later bills",
  amountReturnedToClient:      "Amount returned to client",
  matchingPaymentsToBills:     "Matching payments to bills",
  history:                     "History",
  daysLate:                    (n: number) => `${n} days late`,
  moneyTakenBeforeWorkStarted: "Money taken before work started",
} as const;

/** Scan a piece of rendered text and return every banned term found.
 *  Matching is case-insensitive and word-boundary-aware so short tokens
 *  like "credit" don't false-match inside "creditcard" or "credited".
 *  Used by the snapshot test; not called from render paths. */
export function findBannedTerms(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const term of BANNED_TERMS) {
    // Word-boundary match: term must be surrounded by non-word chars or
    // string edges. Multi-word terms match verbatim.
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i");
    if (re.test(lower)) hits.push(term);
  }
  return hits;
}
