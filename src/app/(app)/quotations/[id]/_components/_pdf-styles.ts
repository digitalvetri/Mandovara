// Styles for the quotation PDF.
//
// Rewritten 2026-08-28 to the format Mandovara actually sends clients —
// the owner supplied two live quotations as the specification. That
// document is a letterhead banner, two yellow identifying bands, one
// bordered ITEM/Unit/QTY/RATE/AMT table and the standing terms. It is
// deliberately plain: red on yellow on white, hard black rules, nothing
// that reads as software output.
//
// The previous styles described a GST tax-quotation with party boxes, a
// supply band and a CGST/SGST breakdown. Nothing else imported them —
// POPdf and InvoicePdf say "styled to match QuotePdf" in their headers
// but define their own StyleSheets, so purchase orders and invoices are
// untouched by this file.

import { StyleSheet } from "@react-pdf/renderer";

/** Mandovara teal — retained for anything that still asks for it. */
export const BRAND = "#1B8A7E";

/** The three colours the source document uses, and no others. */
export const INK    = "#000000";
export const RED    = "#FF0000";
export const YELLOW = "#FFFF00";

/** Column widths as percentages, summing to 100. ITEM takes the slack. */
export const COLS = { item: "44%", unit: "14%", qty: "14%", rate: "14%", amt: "14%" } as const;

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 34, paddingBottom: 40, paddingHorizontal: 46,
    fontFamily: "Geist", fontSize: 9, color: INK, backgroundColor: "#FFFFFF",
  },

  // ── Letterhead ────────────────────────────────────────────────────
  // Left-aligned with the table's left edge, as in the source document.
  // 544x319 artwork: the height below preserves that ratio exactly, so
  // the banner is never stretched the way the Excel original stretches
  // it. Sized to sit just under the source's visual weight — bigger and
  // the terms push onto a second page.
  letterhead: { width: 340, height: 199, marginBottom: 0, alignSelf: "flex-start" },
  letterheadFallback: {
    fontSize: 18, fontWeight: "bold", color: BRAND,
    textAlign: "left", marginBottom: 10,
  },

  // ── Identifying bands ─────────────────────────────────────────────
  band: {
    backgroundColor: YELLOW,
    borderWidth: 1, borderColor: INK, borderStyle: "solid",
    borderBottomWidth: 0,
    paddingVertical: 3, paddingHorizontal: 4,
  },
  bandLast: { borderBottomWidth: 1 },
  bandText: {
    fontSize: 10, fontWeight: "bold", color: RED, textAlign: "center",
  },

  // ── Table ─────────────────────────────────────────────────────────
  table: { borderWidth: 1, borderColor: INK, borderStyle: "solid", borderTopWidth: 0 },
  row:   { flexDirection: "row", minHeight: 15 },
  cell: {
    borderRightWidth: 1, borderColor: INK, borderStyle: "solid",
    borderBottomWidth: 1,
    paddingVertical: 3, paddingHorizontal: 3,
    justifyContent: "center",
  },
  cellLast:   { borderRightWidth: 0 },
  cellNoRule: { borderBottomWidth: 0 },

  cellText:     { fontSize: 9, textAlign: "center" },
  cellTextItem: { fontSize: 9, textAlign: "center" },
  headText:     { fontSize: 9, fontWeight: "bold", color: RED, textAlign: "center" },
  redBold:      { fontSize: 9, fontWeight: "bold", color: RED, textAlign: "center" },
  groupText:    { fontSize: 9, textAlign: "center" },

  // ── Terms ─────────────────────────────────────────────────────────
  termsWrap:  { marginTop: 14 },
  term:       { fontSize: 8.5, marginBottom: 4, lineHeight: 1.35 },
  termRed:    { fontSize: 8.5, marginBottom: 4, lineHeight: 1.35, fontWeight: "bold", color: RED },
  policyHead: { fontSize: 9, fontWeight: "bold", color: RED, marginTop: 6, marginBottom: 4 },
  closing:    { fontSize: 8.5, marginTop: 4, lineHeight: 1.35 },
  caveat: {
    fontSize: 8.5, marginTop: 10, marginBottom: 2,
    fontWeight: "bold", color: RED, lineHeight: 1.35,
  },
});
