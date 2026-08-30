// Styles for the quotation PDF.
//
// Redesigned 2026-08-30 (owner: "redesign a wonderful quotation output
// but use the same contents"). Every field on the page is the one that
// was there before — letterhead, client and area, the
// ITEM/Unit/QTY/RATE/AMT table, group captions, the discount line, the
// total, and the standing terms. What changed is how it is set.
//
// The previous version reproduced the studio's Excel original literally:
// pure #FFFF00 fills, #FF0000 text, and a 1px black box around every
// cell. That is what a spreadsheet prints — not what a studio charging
// six figures for interiors hands a client.
//
// The rules it follows now:
//
//   · One accent, Mandovara's teal. Red keeps exactly one job — money
//     coming off the total — where the colour change carries meaning.
//   · Hairline rules, horizontal only. A box around every cell is what
//     makes a table look like a spreadsheet; alignment does the same
//     work far more quietly.
//   · Figures are right-aligned. A column of money is read down its last
//     digit, and centring it (as the original did) destroys that.
//   · Space is the real upgrade: row height, a gap between the table and
//     the terms, and leading in the terms themselves.
//
// POPdf and InvoicePdf say "styled to match QuotePdf" in their headers
// but define their own StyleSheets and import nothing from here, so
// purchase orders and invoices are untouched by this file.

import { StyleSheet } from "@react-pdf/renderer";

/** Mandovara teal — the single accent. */
export const BRAND      = "#1B8A7E";
export const BRAND_DEEP = "#14655C";
/** A wash of the accent, for the header row, captions and the total. */
export const BRAND_TINT = "#EEF7F5";

/** Near-black rather than #000 — softer on paper, fully legible. */
export const INK       = "#1A1A1A";
export const INK_SOFT  = "#5B6470";
export const RULE      = "#DFE4E8";
export const RULE_SOFT = "#EDF0F2";
/** Deductions only. */
export const DEDUCT    = "#B3261E";

export const COLS = { item: "46%", unit: "13%", qty: "12%", rate: "14.5%", amt: "14.5%" } as const;

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 26, paddingBottom: 28, paddingHorizontal: 42,
    fontFamily: "Geist", fontSize: 9, color: INK, backgroundColor: "#FFFFFF",
  },

  // ── Letterhead ────────────────────────────────────────────────────
  letterhead: { width: 196, height: 115, marginBottom: 12, alignSelf: "flex-start" },
  letterheadFallback: {
    fontSize: 20, fontWeight: "bold", color: BRAND,
    textAlign: "left", marginBottom: 18,
  },

  // ── Client band ───────────────────────────────────────────────────
  // The two yellow bars became one quiet block: the client's name set
  // large, everything else secondary beneath it, and a rule in the
  // accent carrying the brand without shouting.
  headRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13 },
  partyBlock: {
    borderLeftWidth: 2.5, borderLeftColor: BRAND, borderStyle: "solid",
    paddingLeft: 10,
  },
  partyLabel: { fontSize: 7, letterSpacing: 1.4, color: INK_SOFT, marginBottom: 4 },
  partyName:  { fontSize: 14, fontWeight: "bold", color: INK, marginBottom: 2 },
  partyMeta:  { fontSize: 9, color: INK_SOFT },

  // ── Table ─────────────────────────────────────────────────────────
  table: { marginBottom: 0 },

  head:     { flexDirection: "row", backgroundColor: BRAND },
  headCell: { paddingVertical: 6.5, paddingHorizontal: 7 },
  headText: { fontSize: 7.5, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 0.9 },

  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: RULE_SOFT, borderStyle: "solid",
    minHeight: 19,
  },
  rowAlt: { backgroundColor: "#FAFBFC" },
  cell:   { paddingVertical: 5, paddingHorizontal: 7, justifyContent: "center" },

  cellText:  { fontSize: 9.5, color: INK },
  cellMuted: { fontSize: 9.5, color: INK_SOFT, textAlign: "center" },
  num:       { fontSize: 9.5, color: INK, textAlign: "right" },

  // A caption row — the room name as a quiet band, rather than a
  // bordered cell with four empty neighbours beside it.
  groupRow: {
    flexDirection: "row",
    backgroundColor: BRAND_TINT,
    borderBottomWidth: 0.5, borderBottomColor: RULE_SOFT, borderStyle: "solid",
  },
  groupText: {
    fontSize: 7.5, fontWeight: "bold", color: BRAND_DEEP, letterSpacing: 1.1,
    paddingVertical: 5.5, paddingHorizontal: 7,
  },

  deductLabel: { fontSize: 9, color: DEDUCT },
  deductNum:   { fontSize: 9.5, color: DEDUCT, textAlign: "right" },

  // ── Total ─────────────────────────────────────────────────────────
  // Its own block below the table rather than one more row inside it.
  // The number a client looks for first should not be just another cell.
  totalWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10, marginBottom: 15 },
  totalBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: BRAND_TINT,
    borderTopWidth: 1.5, borderTopColor: BRAND, borderStyle: "solid",
    paddingVertical: 7.5, paddingHorizontal: 11,
    width: "45%",
  },
  totalLabel: { fontSize: 8, fontWeight: "bold", color: BRAND_DEEP, letterSpacing: 1.2 },
  totalValue: { fontSize: 14, fontWeight: "bold", color: BRAND_DEEP, textAlign: "right" },

  // ── Terms ─────────────────────────────────────────────────────────
  termsWrap: { borderTopWidth: 0.5, borderTopColor: RULE, borderStyle: "solid", paddingTop: 10 },
  termsHead: { fontSize: 7.5, fontWeight: "bold", color: BRAND_DEEP, letterSpacing: 1.3, marginBottom: 6 },

  // Hanging indent: the number sits in its own column so a wrapped line
  // aligns under the text rather than under the digit.
  termRow:    { flexDirection: "row", marginBottom: 3.2 },
  termNum:    { width: 12, fontSize: 7.6, color: INK_SOFT },
  termText:   { flex: 1, fontSize: 7.6, color: INK, lineHeight: 1.42 },
  termStrong: { flex: 1, fontSize: 7.6, color: BRAND_DEEP, fontWeight: "bold", lineHeight: 1.42 },

  policyHead: { fontSize: 7.5, fontWeight: "bold", color: BRAND_DEEP, letterSpacing: 1.3, marginTop: 9, marginBottom: 6 },
  closing:    { fontSize: 7.6, color: INK_SOFT, lineHeight: 1.42, marginTop: 2.5 },

  caveat: {
    fontSize: 8.5, color: BRAND_DEEP, fontWeight: "bold",
    backgroundColor: BRAND_TINT,
    paddingVertical: 6, paddingHorizontal: 9,
    marginBottom: 10, lineHeight: 1.35,
  },
});
