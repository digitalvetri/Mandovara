// computeProjectDue — the ONE formula for what a client still owes on a
// project under the quotation-first flow.
//
//   due = agreedValue − receivedOnProject      (clamped at 0)
//
// Why this exists alongside computeOutstanding (which is per-invoice):
//
// The studio quotes, the client accepts, the job becomes a project, money
// arrives against that agreement, and the tax invoice is raised only at
// the end once the money is in. For most of a project's life there is no
// invoice at all, so an invoice-only definition of "owed" reported ₹0 due
// on a job with ₹4 lakh outstanding, and every advance landed in Accounts
// → Received as "not matched to a bill". The agreement — the accepted
// quotation — is what the debt hangs off. The invoice is the receipt for
// it, issued last.
//
// computeOutstanding is still the formula for one invoice's balance and is
// unchanged. The two must never be summed for the same project: money owed
// on a project is counted here, and once that project is invoiced its
// receipts are allocated onto the invoice so both formulas report the same
// settled figure.

/** What the client committed to. The accepted quotation wins; a sent one is
 *  the next best evidence; the stored Project.orderValue is the last resort
 *  for projects that predate the quotation-first flow. */
export function pickAgreedValue(
  acceptedQuotationTotal: bigint | null,
  latestQuotationTotal:   bigint | null,
  storedOrderValue:       bigint,
): bigint {
  if (acceptedQuotationTotal != null && acceptedQuotationTotal > 0n) return acceptedQuotationTotal;
  if (latestQuotationTotal   != null && latestQuotationTotal   > 0n) return latestQuotationTotal;
  return storedOrderValue > 0n ? storedOrderValue : 0n;
}

/** Money still to collect on the project. Never negative — an overpayment
 *  is credit, not a negative debt; ask computeProjectCredit for that. */
export function computeProjectDue(agreedValue: bigint, receivedOnProject: bigint): bigint {
  const due = agreedValue - receivedOnProject;
  return due < 0n ? 0n : due;
}

/** Money received beyond the agreed value — the client is in credit. */
export function computeProjectCredit(agreedValue: bigint, receivedOnProject: bigint): bigint {
  const credit = receivedOnProject - agreedValue;
  return credit < 0n ? 0n : credit;
}

/** What a project owes, once its bills are taken into account too.
 *
 *  Nearly always this is just `agreed − received`. The second term matters
 *  when an invoice bills MORE than the quotation did — extra work agreed on
 *  site, a rate changed during the job. Then the agreement is settled while
 *  the bill is not, and taking only the first term would make the extra
 *  invisible on every screen at once.
 *
 *  It is a maximum and not a sum, which is what stops the same rupees being
 *  counted twice. A bill raised early for the full quoted amount on a job
 *  where nothing has been paid gives 400k and 400k → 400k owed, not 800k. */
export function combineProjectDue(agreementDue: bigint, invoiceDue: bigint): bigint {
  return agreementDue > invoiceDue ? agreementDue : invoiceDue;
}

/** True once every rupee of the agreement — and of anything billed beyond it
 *  — has landed. This is the gate the invoice sits behind: the studio bills
 *  after it has been paid.
 *
 *  A project with no agreed value at all is NOT settled — there is nothing
 *  to have paid off, and treating ₹0 as "fully paid" would open the invoice
 *  gate on every empty project. */
export function isProjectFullySettled(
  agreedValue: bigint,
  receivedOnProject: bigint,
  invoiceDue: bigint = 0n,
): boolean {
  if (agreedValue <= 0n) return false;
  if (invoiceDue > 0n) return false;
  return receivedOnProject >= agreedValue;
}

/** Percentage of the agreement collected, 0–100, rounded down. Presentation
 *  only — never feed this back into a money calculation. */
export function collectedPct(agreedValue: bigint, receivedOnProject: bigint): number {
  if (agreedValue <= 0n) return 0;
  const capped = receivedOnProject > agreedValue ? agreedValue : receivedOnProject;
  return Number((capped * 100n) / agreedValue);
}

/** The one rule for counting money that has reached a project.
 *
 * A rupee arrives by one of three routes and must be counted exactly once:
 *
 *   · `notOnABill` — the slice of a receipt booked to this project that has
 *     not been applied to any invoice (`Receipt.unallocated`).
 *   · `onThisProjectsBills` — allocations onto the project's own invoices.
 *   · `legacyAdvances` — rows in the old `Advance` table. Read-only.
 *
 * The invariant this exists to protect: raising the invoice at the end of a
 * job MOVES money from the first bucket to the second, and the total must
 * not move with it. Expressed as a pure function so that invariant can be
 * asserted without a database — see tests/kernel/money/project-due.test.ts.
 *
 * Bounced receipts are the caller's job to exclude: a bounce restores the
 * full amount to `unallocated`, so a bounced cheque left in the first bucket
 * would credit money that never arrived.
 */
export function accumulateReceived(input: {
  notOnABill:          readonly bigint[];
  onThisProjectsBills: readonly bigint[];
  legacyAdvances:      readonly bigint[];
}): bigint {
  let total = 0n;
  for (const v of input.notOnABill)          total += v;
  for (const v of input.onThisProjectsBills) total += v;
  for (const v of input.legacyAdvances)      total += v;
  return total;
}
