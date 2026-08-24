import path from "path";
import { Font, StyleSheet } from "@react-pdf/renderer";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

export const BRAND  = "#1B8A7E";
export const BRANDL = "#D1EDE9";
export const WHITE  = "#FFFFFF";
export const INK    = "#111827";
export const MUTED  = "#6B7280";
export const RULE   = "#E5E7EB";
export const STRIP  = "#F8FAFB";
export const DARK   = "#0E1F1D";
export const GOOD   = "#15803d";
export const BAD    = "#dc2626";

export const ADDR = "32 Thirumoorthy Layout, RS Puram, Coimbatore 641002";

export const s = StyleSheet.create({
  page:        { fontFamily: "Geist", fontSize: 9, color: INK, backgroundColor: WHITE, paddingTop: 0, paddingBottom: 52 },
  stripe:      { height: 6, backgroundColor: BRAND },

  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 32, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 0.75, borderBottomColor: RULE },
  logoImg:     { width: 200, height: 66, objectFit: "cover", objectPosition: "center center" },
  logoTagline: { fontSize: 6.5, color: MUTED, letterSpacing: 1.8, marginTop: 4, paddingLeft: 22 },
  headerRight: { alignItems: "flex-end" },
  reportEye:   { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 1.8, marginBottom: 6 },
  reportTitle: { fontSize: 16, fontWeight: "bold", color: INK, marginBottom: 8 },
  metaRow:     { flexDirection: "row", gap: 4, alignItems: "baseline", marginTop: 2 },
  metaLbl:     { fontSize: 6.5, color: MUTED, letterSpacing: 0.5 },
  metaVal:     { fontSize: 7.5, color: INK, fontWeight: "bold" },

  kpiWrap:   { paddingHorizontal: 32, paddingVertical: 14, borderBottomWidth: 0.75, borderBottomColor: RULE },
  kpiRow:    { flexDirection: "row", gap: 8 },
  kpiCard:   { flex: 1, borderWidth: 0.75, borderColor: RULE, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: STRIP },
  kpiLabel:  { fontSize: 6.5, color: MUTED, letterSpacing: 0.8, marginBottom: 5 },
  kpiValue:  { fontSize: 14, fontWeight: "bold", color: INK },
  kpiWarn:   { color: BAD },

  twoCol:       { flexDirection: "row", gap: 12, paddingHorizontal: 32, marginTop: 12 },
  col:          { flex: 1 },
  cardWrap:     { borderWidth: 0.75, borderColor: RULE, borderRadius: 6, overflow: "hidden" },
  cardHead:     { backgroundColor: BRANDL, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: RULE },
  cardHeadText: { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 1.1 },
  cardBody:     { paddingHorizontal: 10 },
  row:          { flexDirection: "row", alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 5.5 },
  rowLast:      { flexDirection: "row", alignItems: "center", paddingVertical: 5.5 },
  tdf:          { flex: 1, fontSize: 8, color: INK },
  tdCount:      { width: 26, textAlign: "right", fontSize: 7.5, color: MUTED },
  tdMoney:      { width: 90, textAlign: "right", fontSize: 8, color: INK },
  tdPct:        { width: 34, textAlign: "right", fontSize: 7.5, color: MUTED },
  empty:        { paddingVertical: 14, fontSize: 8, color: MUTED, textAlign: "center" },

  finRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5.5, borderBottomWidth: 0.5, borderBottomColor: RULE },
  finRowLast: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5.5 },
  finLabel:   { fontSize: 8, color: MUTED },
  finValue:   { fontSize: 8, color: INK, fontWeight: "bold" },
  finWarn:    { fontSize: 8, color: BAD, fontWeight: "bold" },

  secHead:   { paddingHorizontal: 32, paddingTop: 16, paddingBottom: 8 },
  secTitle:  { fontSize: 8, fontWeight: "bold", color: BRAND, letterSpacing: 1.5 },
  tableWrap: { paddingHorizontal: 32 },
  thead:     { flexDirection: "row", backgroundColor: BRAND, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 4, marginBottom: 1 },
  th:        { fontSize: 7, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  tr:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: RULE },

  divider: { borderTopWidth: 0.75, borderTopColor: RULE, marginHorizontal: 32, marginTop: 20, marginBottom: 4 },

  footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingVertical: 12, paddingHorizontal: 32 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerBrand: { fontSize: 7.5, fontWeight: "bold", color: WHITE },
  footerText:  { fontSize: 6.5, color: "#9CA3AF" },
});
