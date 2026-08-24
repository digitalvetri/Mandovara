import { StyleSheet } from "@react-pdf/renderer";

export const BRAND  = "#1B8A7E";
export const BRANDL = "#D1EDE9";
export const WHITE  = "#FFFFFF";
export const INK    = "#111827";
export const MUTED  = "#6B7280";
export const RULE   = "#E5E7EB";
export const STRIP  = "#F8FAFB";
export const DARK   = "#0E1F1D";

// Cropped logo aspect ratio: 492 × 139 → 3.54 : 1
// At width 280 → height 79  (fills the container with no whitespace wasted)

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Geist", fontSize: 9, color: INK,
    backgroundColor: WHITE,
    paddingTop: 0, paddingBottom: 52, paddingHorizontal: 0,
  },

  // ── stripe ───────────────────────────────────────────────────────
  stripe: { height: 6, backgroundColor: BRAND },

  // ── header ───────────────────────────────────────────────────────
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 32, paddingTop: 22, paddingBottom: 20,
    borderBottomWidth: 0.75, borderBottomColor: RULE,
  },
  logoImg: { width: 280, height: 79, objectFit: "contain", objectPosition: "left center" },

  // right side of header
  headerMeta: { alignItems: "flex-end" },
  docBadge: {
    backgroundColor: BRAND, color: WHITE, fontSize: 7, fontWeight: "bold",
    letterSpacing: 2, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 3, marginBottom: 9, alignSelf: "flex-end",
  },
  docNumber:  { fontSize: 13, fontWeight: "bold", color: INK, marginBottom: 6 },
  docMetaRow: { flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 3 },
  docMetaLbl: { fontSize: 6.5, color: MUTED, letterSpacing: 0.5 },
  docMetaVal: { fontSize: 7.5, color: INK, fontWeight: "bold" },

  // ── party boxes ──────────────────────────────────────────────────
  partyRow: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 32, paddingTop: 20, paddingBottom: 20,
    borderBottomWidth: 0.75, borderBottomColor: RULE,
  },
  partyBox:   { flex: 1, borderWidth: 0.75, borderColor: RULE, borderRadius: 6, padding: 16, backgroundColor: STRIP },
  partyLabel: { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 1.3, marginBottom: 9 },
  partyName:  { fontSize: 11, fontWeight: "bold", color: INK, marginBottom: 5 },
  partyLine:  { fontSize: 8, color: MUTED, lineHeight: 1.65, marginBottom: 1 },
  partyAccent:{ fontSize: 8, color: BRAND, marginTop: 5 },

  // ── supply band ──────────────────────────────────────────────────
  supplyBand: {
    flexDirection: "row", gap: 28,
    paddingHorizontal: 32, paddingVertical: 11,
    backgroundColor: BRANDL,
    borderTopWidth: 0.5, borderTopColor: BRAND,
    borderBottomWidth: 0.5, borderBottomColor: BRAND,
  },
  supplyItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  supplyLbl:  { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 0.5 },
  supplyVal:  { fontSize: 7.5, color: INK },

  // ── table ────────────────────────────────────────────────────────
  tableWrap: { paddingHorizontal: 32, marginTop: 18, marginBottom: 6 },
  thead: {
    flexDirection: "row", backgroundColor: BRAND,
    paddingVertical: 9, borderRadius: 4, marginBottom: 1,
  },
  th:      { fontSize: 6.5, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  tr:      { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 10 },
  tdMain:  { fontSize: 8.5, color: INK },
  tdSub:   { fontSize: 6.5, color: MUTED, marginTop: 2.5, lineHeight: 1.5 },
  tdOpt:   { fontSize: 6.5, color: BRAND, marginTop: 2.5 },
  tdRight: { fontSize: 8.5, textAlign: "right" },
  tdMuted: { fontSize: 7.5, color: MUTED, textAlign: "right" },

  // Column widths (usable width ≈ 531pt inside 32pt margins each side)
  // cSwt(10) + cNo(18) + cQtyU(52) + cRate(72) + cHsn(36) + cGst(26) + cAmt(70) = 284pt fixed
  // cDesc gets the remaining ~247pt via flex:1
  cSwt:  { width: 10,  paddingHorizontal: 1 },
  cNo:   { width: 18,  paddingHorizontal: 3 },
  cDesc: { flex: 1,    paddingHorizontal: 5 },
  cQtyU: { width: 52,  paddingHorizontal: 3 },
  cRate: { width: 72,  paddingHorizontal: 3 },
  cHsn:  { width: 36,  paddingHorizontal: 3 },
  cGst:  { width: 26,  paddingHorizontal: 3 },
  cAmt:  { width: 70,  paddingHorizontal: 3 },
  // Legacy aliases retained so old references compile without breakage
  cQty:  { width: 38,  paddingHorizontal: 3 },
  cUnit: { width: 26,  paddingHorizontal: 3 },

  // ── room group header ─────────────────────────────────────────────
  roomHeader: {
    flexDirection: "row", backgroundColor: BRANDL,
    paddingVertical: 5, paddingHorizontal: 10, marginTop: 6, borderRadius: 3,
    borderLeftWidth: 3, borderLeftColor: BRAND,
  },
  roomHeaderText: { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 0.8 },

  // ── divider ──────────────────────────────────────────────────────
  divider: {
    borderTopWidth: 0.75, borderTopColor: RULE,
    marginHorizontal: 32, marginTop: 16, marginBottom: 16,
  },

  // ── bottom: terms | totals ───────────────────────────────────────
  bottomRow:   { flexDirection: "row", gap: 20, paddingHorizontal: 32 },
  termsCol:    { flex: 1 },
  termsSec:    { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 1.1, marginBottom: 8 },
  termsBullet: { fontSize: 7.5, color: MUTED, lineHeight: 1.75, marginBottom: 2 },

  totalsCol:  { width: 234 },
  totRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5.5, borderBottomWidth: 0.5, borderBottomColor: RULE },
  totLbl:     { fontSize: 8, color: MUTED },
  totVal:     { fontSize: 8, color: INK },

  // Grand total box — teal, with words inside
  grandBox:   { backgroundColor: BRAND, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 5, marginTop: 10 },
  grandRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
  grandLbl:   { fontSize: 9, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  grandAmt:   { fontSize: 15, fontWeight: "bold", color: WHITE },
  wordsText:  { fontSize: 7, color: BRANDL, lineHeight: 1.45 },

  // ── payment schedule (inside totals col, above grand total box) ──
  paySection:  { marginBottom: 12, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: RULE },
  paySec:      { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 1.1, marginBottom: 6 },
  payRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  payLbl:      { fontSize: 7.5, color: MUTED },
  payVal:      { fontSize: 7.5, color: INK, fontWeight: "bold" },

  // ── bank / UPI block (inside terms col, below terms list) ────────
  bankSection: { marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: RULE },
  bankSec:     { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 1.1, marginBottom: 6 },
  bankRow:     { flexDirection: "row", gap: 5, paddingVertical: 2 },
  bankLbl:     { fontSize: 7, color: MUTED, width: 34 },
  bankVal:     { fontSize: 7, color: INK },

  // ── signature block ───────────────────────────────────────────────
  sigSection:  { flexDirection: "row", gap: 20, paddingHorizontal: 32, marginTop: 20, paddingTop: 16, borderTopWidth: 0.75, borderTopColor: RULE },
  sigCol:      { flex: 1, paddingTop: 4 },
  sigLabel:    { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 1.1, marginBottom: 24 },
  sigLine:     { borderBottomWidth: 0.75, borderBottomColor: INK, marginBottom: 6 },
  sigName:     { fontSize: 7.5, color: INK, fontWeight: "bold" },
  sigRole:     { fontSize: 7, color: MUTED, marginTop: 2 },

  // ── footer ───────────────────────────────────────────────────────
  footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingVertical: 12, paddingHorizontal: 32 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerBrand: { fontSize: 7.5, fontWeight: "bold", color: WHITE },
  footerText:  { fontSize: 6.5, color: "#9CA3AF" },
});
