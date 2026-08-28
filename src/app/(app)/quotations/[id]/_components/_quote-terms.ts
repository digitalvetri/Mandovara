// The studio's standing terms, transcribed from the quotations Mandovara
// already sends clients (VINITHA MAM.pdf / SENTHIL SIR NEELAMBUR.pdf,
// supplied by the owner 2026-08-28).
//
// Copied VERBATIM, including the wording and spelling of the originals —
// this is the studio's own commercial boilerplate and not something to
// silently reword. Two things worth knowing before anyone edits:
//
//   · Item 3 ends mid-sentence ("...with the customer's") in BOTH source
//     PDFs. It is reproduced as-is rather than guessed at.
//   · "discrepencies", "Requistion" and "proccessed" are the originals'
//     spellings.
//
// A quotation's own termsText still overrides these when one is set.

/** Numbered terms printed under the table. */
export const MANDOVARA_TERMS: readonly string[] = [
  "Consumption will be as per the standard packages available either in the form of rolls or meters",
  "Full Advance Payment to be paid as per mentioned order value.",
  "For all paid payments, customer to get customer voucher,estimate form,challan with the customer's",
  "Incase of any discrepencies, please SMS on 08940450051.",
  "Any form of concession/discount/scheme is applicable on the products only.",
  "The discount schemes if any is NOT APPLICABLE on surface preparation/labour services/consumables/transport/misc etc.",
  "If the catalogues are stocked by the customer, it is subject to a MOV @ Rs. 6500 per Catalogue & Admin Charges @ Rs. 1500 is applicable.",
];

/** Index (0-based) of the term the originals print in red bold. */
export const EMPHASISED_TERM = 1;

export const CANCELLATION_HEADING = "ORDER CANCELLATION and REFUND POLICY";

/** Its own heading and its own numbering, restarting at 1. */
export const CANCELLATION_TERMS: readonly string[] = [
  "Order once placed cannot be cancelled. Advance once paid will not be refunded.",
  "Refund of advance is granted post deducting the admin charges of Rs1500/- with an option to choose any other product offered by the company.",
  "Refund against excess goods will be done only if it in a packed roll/box/package and saleable condition.Refund will be processed via cheque within 15 days of order completion.",
  "For IR(Import Requistion) orders of non-stock goods, once placed will not be cancelled",
  "Incase of any issues at the customs or force majeure, the refund will be proccessed.",
];

/** Unnumbered closing lines. */
export const CLOSING_LINES: readonly string[] = [
  "Orders once confirmed & advance paid is not subject to cancellation or aborted for whatever",
  "Alternately the Customer is given an option to choose any other Products offered by company.",
];
