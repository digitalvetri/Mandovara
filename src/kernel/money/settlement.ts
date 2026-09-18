// Settlement discount — the money a studio lets go when a client closes
// the account for less than the quote.
//
// Owner, 2026-09-18: "some times the client will close the money like
// getting discount after settling some amount". The quote said ₹1,05,410,
// ₹98,000 came in, and the studio agreed to call it done. Until this
// existed the ₹7,410 sat on the project as money still to collect.
//
// The discount is GST-INCLUSIVE — it is the rupee figure the client and
// the studio agreed to drop. It is never money received: it reduces what
// the client is held to (netAgreedValue), and the tax invoice raised
// afterwards bills the lower figure (spreadDiscount), because a discount
// agreed before the invoice is issued comes off the taxable value.
//
// Pure functions, no I/O, so every rule here is tested without a database.

import { roundHalfUpDivide } from "./paise";

/** What the client is held to once a settlement discount is agreed. */
export function netAgreedValue(agreedValue: bigint, settlementDiscount: bigint): bigint {
  const net = agreedValue - settlementDiscount;
  return net < 0n ? 0n : net;
}

/**
 * Why a settlement discount cannot be given, or null when it can.
 *
 * @param agreedValue the quoted/agreed figure, before any discount.
 * @param received    everything received against the job so far.
 * @param discount    the discount being set — it REPLACES any earlier one.
 */
export function settlementDiscountProblem(
  agreedValue: bigint,
  received:    bigint,
  discount:    bigint,
): string | null {
  if (discount <= 0n) return "Enter a discount greater than zero.";
  if (agreedValue <= 0n) return "This job has no agreed amount to discount.";
  // Letting the whole job go is cancelling it, not settling it — and a
  // project with nothing agreed would read as never having been sold.
  if (discount >= agreedValue) return "The discount cannot be the whole agreed amount.";
  const owedBeforeDiscount = agreedValue - received;
  if (discount > owedBeforeDiscount) {
    return owedBeforeDiscount <= 0n
      ? "Nothing is left to collect on this job, so there is nothing to discount."
      : "The discount cannot be more than what is still to collect.";
  }
  return null;
}

export interface SpreadLine {
  /** Line taxable value in paise, after any line discount. */
  taxable: bigint;
  /** GST rate in per cent — 18, 12, 5, 2.5 … */
  gstRate: number;
}

/**
 * Take a GST-inclusive discount off a set of invoice lines, in proportion.
 *
 * Every line keeps the same share of the bill: each taxable value is
 * scaled by (billed − discount) / billed, where "billed" is the lines'
 * total including GST. Scaling the taxable scales the tax with it, so the
 * lines — tax and all — come to the old total less the discount, to within
 * a few paise of per-line rounding that the invoice round-off absorbs.
 *
 * Returns the new taxable value for each line, in the same order.
 */
export function spreadDiscount(lines: readonly SpreadLine[], discount: bigint): bigint[] {
  // Rates in basis points so 2.5 % is exact.
  const weighted = lines.map((l) => l.taxable * (10_000n + BigInt(Math.round(l.gstRate * 100))));
  const billed   = weighted.reduce((s, w) => s + w, 0n); // ×10,000
  if (discount <= 0n || billed <= 0n) return lines.map((l) => l.taxable);

  const target = billed - discount * 10_000n;
  if (target <= 0n) return lines.map(() => 0n);

  return lines.map((l) => roundHalfUpDivide(l.taxable * target, billed));
}

/**
 * The per-unit rate (paise) that makes a line come to `taxable`, given its
 * quantity and its own line discount — for seeding the invoice builder,
 * which takes a rate and a discount rather than a taxable value.
 *
 * Mirrors the server's arithmetic in createManualInvoice: quantity fixed
 * to 4 decimals, discount in basis points. The result is exact to within
 * half a paisa per unit.
 */
export function rateForTaxable(taxable: bigint, quantity: number, discountPct: number): bigint {
  const qtyFixed = BigInt(Math.round(quantity * 10_000));
  const keepBp   = 10_000n - BigInt(Math.round(discountPct * 100));
  if (taxable <= 0n || qtyFixed <= 0n || keepBp <= 0n) return 0n;
  // taxable = rate × qty × keep  →  rate = taxable / (qty × keep)
  return roundHalfUpDivide(taxable * 10_000n * 10_000n, qtyFixed * keepBp);
}
