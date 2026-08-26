import { StyleSheet } from "@react-pdf/renderer";

// Owner redesign (2026-08-26): the quotation PDF now matches the
// hand-crafted samples the owner used to send — branded banner header,
// yellow customer/location bars, tight 5-column table (ITEM · Unit ·
// QTY · RATE · AMT), red TOTAL, and two blocks of prose T&C + refund
// policy. GST breakdown, party boxes, payment schedule, bank details,
// signature block, and page footer are dropped — the owner wanted the
// customer-facing document to look like an interior-decor estimate,
// not a GST tax invoice.

// Palette
export const INK     = "#111827";
export const MUTED   = "#4B5563";
export const RULE    = "#111827";     // heavy black rules like the sample
export const RULE_LT = "#D1D5DB";
export const WHITE   = "#FFFFFF";
export const YELLOW  = "#FFF200";     // matches sample highlight bar
export const RED     = "#D0021B";     // matches sample table header + TOTAL
export const BRAND   = "#1B8A7E";     // Mandovara teal, used only in header

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Geist", fontSize: 10, color: INK,
    backgroundColor: WHITE,
    paddingTop: 0, paddingBottom: 24, paddingHorizontal: 0,
  },

  // ── Branded header banner ───────────────────────────────────────
  banner: {
    flexDirection: "row", alignItems: "center", gap: 18,
    paddingHorizontal: 28, paddingTop: 22, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: RULE,
    backgroundColor: "#FAFAFA",
  },
  bannerLogoWrap:  { width: 132 },
  bannerLogoImg:   { width: 132, height: 44, objectFit: "contain" },
  bannerRight:     { flex: 1, alignItems: "flex-start" },
  bannerName:      { fontSize: 15, fontWeight: "bold", color: INK, letterSpacing: 0.3 },
  bannerNameRow:   { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6 },
  bannerRole:      { fontSize: 8, color: MUTED, letterSpacing: 1.6 },
  bannerContact:   { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 2 },
  bannerContactRow:{ flexDirection: "row", alignItems: "center", gap: 4 },
  bannerContactIco:{ fontSize: 8, color: BRAND, fontWeight: "bold" },
  bannerContactTxt:{ fontSize: 8, color: INK },
  bannerAddr:      { fontSize: 8, color: INK, marginTop: 4 },

  // ── Yellow highlight bars ───────────────────────────────────────
  yellowBar: {
    backgroundColor: YELLOW,
    borderLeftWidth: 1, borderRightWidth: 1, borderColor: RULE,
    paddingVertical: 5,
    marginHorizontal: 28,
    alignItems: "center", justifyContent: "center",
  },
  yellowBarBorderT: { borderTopWidth: 1 },
  yellowBarBorderB: { borderBottomWidth: 1 },
  yellowBarCustomer:{ fontSize: 11, fontWeight: "bold", color: RED, letterSpacing: 0.4 },
  yellowBarLocation:{ fontSize: 10, fontWeight: "bold", color: INK, letterSpacing: 0.6 },

  // ── Doc meta strip (thin, right-aligned) ────────────────────────
  metaStrip: {
    flexDirection: "row", justifyContent: "flex-end", gap: 16,
    paddingHorizontal: 28, paddingTop: 6, paddingBottom: 4,
  },
  metaLbl: { fontSize: 7, color: MUTED, letterSpacing: 0.5 },
  metaVal: { fontSize: 7.5, color: INK, fontWeight: "bold" },

  // ── Items table ─────────────────────────────────────────────────
  tableWrap: {
    marginHorizontal: 28, marginTop: 0,
    borderWidth: 1, borderColor: RULE,
  },
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1, borderBottomColor: RULE,
    paddingVertical: 6,
  },
  th:     { fontSize: 10, fontWeight: "bold", color: RED, letterSpacing: 0.4 },
  thLbl:  { textAlign: "center" },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: RULE_LT,
    paddingVertical: 5,
  },
  td:       { fontSize: 9.5, color: INK },
  tdCenter: { textAlign: "center" },
  tdRight:  { textAlign: "right" },

  // Section-header row (bare label, empty numeric cells)
  trSection: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: RULE_LT,
    paddingVertical: 5,
    backgroundColor: WHITE,
  },
  tdSection: { fontSize: 10, fontWeight: "bold", color: INK, letterSpacing: 0.4 },

  // Discount row (line-level, red negative amount)
  trDiscount: {
    flexDirection: "row",
    borderBottomWidth: 0.5, borderBottomColor: RULE_LT,
    paddingVertical: 5,
  },
  tdDiscount: { fontSize: 9.5, fontWeight: "bold", color: RED },

  // Total row — red bold, thick top border
  trTotal: {
    flexDirection: "row",
    borderTopWidth: 1, borderTopColor: RULE,
    paddingVertical: 7,
  },
  tdTotal: { fontSize: 11, fontWeight: "bold", color: RED, letterSpacing: 0.6 },

  // Column widths — usable width = 595pt (A4) - 2×28pt margin - 2×1pt border ≈ 537pt.
  //   Item (flex) | Unit 56 | QTY 56 | RATE 72 | AMT 88 → totals 272pt fixed, ~265pt for Item.
  cItem: { flex: 1,  paddingHorizontal: 8 },
  cUnit: { width: 56, paddingHorizontal: 4, borderLeftWidth: 0.5, borderLeftColor: RULE_LT },
  cQty:  { width: 56, paddingHorizontal: 4, borderLeftWidth: 0.5, borderLeftColor: RULE_LT },
  cRate: { width: 72, paddingHorizontal: 6, borderLeftWidth: 0.5, borderLeftColor: RULE_LT },
  cAmt:  { width: 88, paddingHorizontal: 8, borderLeftWidth: 0.5, borderLeftColor: RULE_LT },

  // ── Terms & Policy blocks ────────────────────────────────────────
  policyWrap: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 4 },
  policyLine: { fontSize: 9, color: INK, lineHeight: 1.55, marginBottom: 2 },
  policyLineRed:  { fontSize: 9, color: RED, fontWeight: "bold", lineHeight: 1.55, marginBottom: 2 },
  // Emphasis via bold + red + uppercase letter-spacing instead of
  // italic — the Geist font we registered has no italic variant and
  // react-pdf would fall back or throw depending on version.
  policyHeading:  { fontSize: 10, color: RED, fontWeight: "bold",
                    letterSpacing: 0.6, marginTop: 10, marginBottom: 6 },
});
