import { StyleSheet } from "@react-pdf/renderer";

// Brand colours
export const BRAND   = "#1B8A7E";   // teal
export const BRANDL  = "#E8F5F4";   // light teal tint
export const WHITE   = "#FFFFFF";
export const INK     = "#111827";
export const MUTED   = "#6B7280";
export const RULE    = "#E5E7EB";
export const STRIP   = "#F8FAFB";
export const DARK    = "#0F2027";   // dark header bg

// 595pt page − 2×32pt margins = 531pt usable
export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "Geist", fontSize: 9, color: INK,
    backgroundColor: WHITE,
    paddingTop: 0, paddingBottom: 44, paddingHorizontal: 0,
  },

  // ── top stripe ───────────────────────────────────────────────────
  stripe: { height: 5, backgroundColor: BRAND },

  // ── header (logo + title) ────────────────────────────────────────
  headerWrap: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 32, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 0.75, borderBottomColor: RULE,
  },
  headerLeft:  { flexDirection: "column" },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  docTitle:    { fontSize: 28, fontWeight: "bold", color: BRAND, letterSpacing: 1 },
  docMeta:     { fontSize: 8, color: MUTED, marginTop: 4 },
  docNum:      { fontSize: 9.5, fontWeight: "bold", color: INK, marginTop: 2 },
  logoImg:     { width: 240, height: 80, objectFit: "contain", objectPosition: "left center" },

  // ── meta strip (date + valid) ────────────────────────────────────
  metaStrip: {
    flexDirection: "row", gap: 32,
    paddingHorizontal: 32, paddingVertical: 10,
    backgroundColor: STRIP, borderBottomWidth: 0.75, borderBottomColor: RULE,
  },
  metaLbl: { fontSize: 6.5, color: MUTED, letterSpacing: 0.8, marginBottom: 2 },
  metaVal: { fontSize: 8.5, fontWeight: "bold", color: INK },

  // ── party boxes (from | to) ──────────────────────────────────────
  partyRow: { flexDirection: "row", gap: 12, paddingHorizontal: 32, paddingVertical: 14 },
  partyBox: {
    flex: 1, borderWidth: 0.75, borderColor: RULE, borderRadius: 5,
    padding: 12, backgroundColor: STRIP,
  },
  partyTitle: {
    fontSize: 6.5, fontWeight: "bold", color: BRAND,
    letterSpacing: 1.2, marginBottom: 8, textTransform: "uppercase",
  },
  partyName:  { fontSize: 10.5, fontWeight: "bold", color: INK, marginBottom: 3 },
  partyLine:  { fontSize: 8, color: MUTED, marginBottom: 2, lineHeight: 1.5 },
  partyAccent:{ fontSize: 8, color: BRAND, marginTop: 3 },

  // ── supply band ──────────────────────────────────────────────────
  supplyBand: {
    flexDirection: "row", gap: 24,
    paddingHorizontal: 32, paddingVertical: 8,
    backgroundColor: BRANDL, borderTopWidth: 0.5, borderTopColor: BRAND,
    borderBottomWidth: 0.5, borderBottomColor: BRAND,
    marginBottom: 14,
  },
  supplyItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  supplyLbl:  { fontSize: 7, color: BRAND, fontWeight: "bold" },
  supplyVal:  { fontSize: 7.5, color: INK },

  // ── table ────────────────────────────────────────────────────────
  tableWrap: { paddingHorizontal: 32, marginBottom: 12 },
  thead: {
    flexDirection: "row", backgroundColor: BRAND,
    paddingVertical: 7, borderRadius: 3, marginBottom: 1,
  },
  th:      { fontSize: 6.5, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  tr:      { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 6 },
  tdMain:  { fontSize: 8, color: INK },
  tdSub:   { fontSize: 6.5, color: MUTED, marginTop: 1.5 },
  tdOpt:   { fontSize: 6.5, color: BRAND, marginTop: 1.5 },
  tdRight: { fontSize: 8, textAlign: "right" },
  tdMuted: { fontSize: 7.5, color: MUTED, textAlign: "right" },

  // Column widths (531pt − 64pt horizontal padding = 467pt table)
  cNo:   { width: 20,  paddingHorizontal: 3 },
  cDesc: { flex: 1,    paddingHorizontal: 5 },
  cQty:  { width: 38,  paddingHorizontal: 3 },
  cUnit: { width: 28,  paddingHorizontal: 3 },
  cRate: { width: 72,  paddingHorizontal: 3 },
  cGst:  { width: 30,  paddingHorizontal: 3 },
  cAmt:  { width: 72,  paddingHorizontal: 3 },

  // ── bottom section (terms | totals) ─────────────────────────────
  bottomRow: {
    flexDirection: "row", gap: 16, paddingHorizontal: 32, marginBottom: 12,
  },
  termsCol: { flex: 1 },
  termsSec: { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 1, marginBottom: 6 },
  termsBullet: { fontSize: 7.5, color: MUTED, lineHeight: 1.6, marginBottom: 2 },

  totalsCol: { width: 220 },
  totRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: RULE,
  },
  totLbl: { fontSize: 8, color: MUTED },
  totVal: { fontSize: 8, color: INK },
  grandRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: BRAND, paddingVertical: 9, paddingHorizontal: 10,
    borderRadius: 4, marginTop: 8,
  },
  grandLbl: { fontSize: 8.5, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  grandVal: { fontSize: 14, fontWeight: "bold", color: WHITE },

  // ── words ────────────────────────────────────────────────────────
  wordsWrap: { paddingHorizontal: 32, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: RULE },
  wordsLbl:  { fontSize: 6.5, fontWeight: "bold", color: MUTED, letterSpacing: 0.8, marginBottom: 3 },
  wordsText: { fontSize: 8, color: INK, lineHeight: 1.5 },

  // ── footer ───────────────────────────────────────────────────────
  footer:     { position: "absolute", bottom: 0, left: 0, right: 0,
                backgroundColor: DARK, paddingVertical: 10, paddingHorizontal: 32 },
  footerRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 6.5, color: "#9CA3AF" },
  footerBrand:{ fontSize: 7, fontWeight: "bold", color: WHITE },
});
