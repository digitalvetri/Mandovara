// Extracted from QuotePdf.tsx to keep that file under the 300-line cap.
// react-pdf StyleSheet — every style used by the quotation PDF lives here.

import { StyleSheet } from "@react-pdf/renderer";

// Colours
export const BRAND  = "#1B8A7E";
export const BRANDL = "#E8F5F4"; // light teal tint
export const WHITE  = "#FFFFFF";
export const INK    = "#111827";
export const MUTED  = "#6B7280";
export const RULE   = "#E5E7EB";
export const STRIP  = "#F9FAFB";

// Usable width: 595 − 64 = 531 pt
export const pdfStyles = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9, color: INK, backgroundColor: WHITE,
          paddingTop: 28, paddingBottom: 48, paddingHorizontal: 32 },

  // Header
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
               marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: BRAND },
  logoImg:   { width: 160, height: 50, objectFit: "contain" },
  quotRight: { alignItems: "flex-end" },
  quotTitle: { fontSize: 22, fontWeight: "bold", color: BRAND, letterSpacing: 3 },
  quotNum:   { fontSize: 8.5, color: MUTED, marginTop: 4 },
  quotRev:   { fontSize: 7.5, color: MUTED, marginTop: 2 },

  // Info strip
  infoStrip: { flexDirection: "row", backgroundColor: STRIP, borderWidth: 0.75, borderColor: RULE,
               borderRadius: 4, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 14 },
  infoCol:   { flex: 1 },
  infoLbl:   { fontSize: 6.5, color: MUTED, letterSpacing: 0.9, marginBottom: 3 },
  infoVal:   { fontSize: 8.5, fontWeight: "bold" },

  // Customer + total row
  custRow:      { flexDirection: "row", gap: 12, marginBottom: 14 },
  custBox:      { flex: 1, flexDirection: "row", gap: 10, borderWidth: 0.75, borderColor: RULE,
                  borderRadius: 4, padding: 10, backgroundColor: STRIP, alignItems: "flex-start" },
  avatar:       { width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND,
                  justifyContent: "center", alignItems: "center", flexShrink: 0 },
  avatarLetter: { fontSize: 12, fontWeight: "bold", color: WHITE },
  custInfo:     { flex: 1 },
  custName:     { fontSize: 11, fontWeight: "bold", color: INK, marginBottom: 2 },
  custLine:     { fontSize: 8, color: MUTED, marginTop: 1.5 },
  custProject:  { fontSize: 8, color: BRAND, marginTop: 3 },

  totalBox:    { width: 170, borderWidth: 0.75, borderColor: BRANDL, borderRadius: 4,
                 backgroundColor: BRANDL, padding: 12, alignItems: "flex-end" },
  totalLbl:    { fontSize: 7, color: BRAND, letterSpacing: 1, marginBottom: 4, fontWeight: "bold" },
  totalAmt:    { fontSize: 18, fontWeight: "bold", color: BRAND },
  totalIncl:   { fontSize: 7, color: BRAND, marginTop: 3, opacity: 0.7 },

  // Table
  tableWrap: { marginBottom: 10 },
  thead:     { flexDirection: "row", backgroundColor: BRAND, paddingVertical: 6,
               borderRadius: 3, marginBottom: 1 },
  th:        { fontSize: 6.5, fontWeight: "bold", color: WHITE, letterSpacing: 0.5 },
  tr:        { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 5 },
  tdLeft:    { fontSize: 8 },
  tdRight:   { fontSize: 8, textAlign: "right" },
  tdMuted:   { fontSize: 6.5, color: MUTED, marginTop: 1.5 },
  tdOpt:     { fontSize: 6.5, color: BRAND, marginTop: 1.5 },

  // Column widths
  cNo:   { width: 18,  paddingHorizontal: 3 },
  cDesc: { flex: 1,    paddingHorizontal: 5 },
  cQty:  { width: 34,  paddingHorizontal: 3 },
  cUnit: { width: 28,  paddingHorizontal: 3 },
  cRate: { width: 76,  paddingHorizontal: 3 },
  cGst:  { width: 32,  paddingHorizontal: 3 },
  cAmt:  { width: 76,  paddingHorizontal: 3 },

  // Words + totals split row
  summaryRow:    { flexDirection: "row", gap: 12, marginBottom: 12 },
  wordsBox:      { flex: 1, paddingTop: 4 },
  wordsLbl:      { fontSize: 6.5, fontWeight: "bold", color: MUTED, letterSpacing: 0.8, marginBottom: 4 },
  wordsText:     { fontSize: 8, color: INK, lineHeight: 1.5 },

  totalsBox:     { width: 230 },
  totRow:        { flexDirection: "row", justifyContent: "space-between",
                   paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: RULE },
  totLbl:        { fontSize: 8, color: MUTED },
  totVal:        { fontSize: 8 },
  grandRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                   backgroundColor: BRAND, paddingVertical: 8, paddingHorizontal: 10,
                   borderRadius: 3, marginTop: 6 },
  grandLbl:      { fontSize: 8, fontWeight: "bold", color: WHITE, letterSpacing: 0.8 },
  grandVal:      { fontSize: 13, fontWeight: "bold", color: WHITE },

  // Tax info + terms split row
  bottomRow:  { flexDirection: "row", gap: 12, borderTopWidth: 0.75, borderTopColor: RULE, paddingTop: 10 },
  bottomCol:  { flex: 1 },
  bottomSec:  { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 1, marginBottom: 6 },
  bottomItem: { flexDirection: "row", marginBottom: 4 },
  bottomLbl:  { fontSize: 7.5, color: MUTED, width: 90 },
  bottomVal:  { fontSize: 7.5, color: INK, flex: 1 },
  termsBullet:{ fontSize: 7.5, color: MUTED, lineHeight: 1.55, marginBottom: 2 },

  // Footer
  footer:     { position: "absolute", bottom: 20, left: 32, right: 32,
                borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 5 },
  footerRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 6.5, color: MUTED },
});
