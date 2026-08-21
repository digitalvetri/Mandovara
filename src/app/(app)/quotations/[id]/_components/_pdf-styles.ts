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

  // Column widths  (467pt usable inside 32pt margins each side)
  cNo:   { width: 22,  paddingHorizontal: 4 },
  cDesc: { flex: 1,    paddingHorizontal: 6 },
  cQty:  { width: 38,  paddingHorizontal: 3 },
  cUnit: { width: 26,  paddingHorizontal: 3 },
  cRate: { width: 76,  paddingHorizontal: 3 },
  cGst:  { width: 28,  paddingHorizontal: 3 },
  cAmt:  { width: 76,  paddingHorizontal: 3 },

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

  // ── footer ───────────────────────────────────────────────────────
  footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingVertical: 12, paddingHorizontal: 32 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerBrand: { fontSize: 7.5, fontWeight: "bold", color: WHITE },
  footerText:  { fontSize: 6.5, color: "#9CA3AF" },
});
