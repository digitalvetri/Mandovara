import path from "path";
import { Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const BRAND  = "#1B8A7E";
const BRANDL = "#D1EDE9";
const WHITE  = "#FFFFFF";
const INK    = "#111827";
const MUTED  = "#6B7280";
const RULE   = "#E5E7EB";
const STRIP  = "#F8FAFB";
const DARK   = "#0E1F1D";
const GOOD   = "#15803d";
const BAD    = "#dc2626";

const s = StyleSheet.create({
  page:        { fontFamily: "Geist", fontSize: 9, color: INK, backgroundColor: WHITE, paddingTop: 0, paddingBottom: 52 },
  stripe:      { height: 6, backgroundColor: BRAND },

  // ── header ──────────────────────────────────────────────────────────────
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 32, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 0.75, borderBottomColor: RULE },
  logoImg:     { width: 200, height: 66, objectFit: "cover", objectPosition: "center center" },
  logoTagline: { fontSize: 6.5, color: MUTED, letterSpacing: 1.8, marginTop: 4, paddingLeft: 22 },
  headerRight: { alignItems: "flex-end" },
  reportEye:   { fontSize: 7, fontWeight: "bold", color: BRAND, letterSpacing: 1.8, marginBottom: 6 },
  reportTitle: { fontSize: 16, fontWeight: "bold", color: INK, marginBottom: 8 },
  metaRow:     { flexDirection: "row", gap: 4, alignItems: "baseline", marginTop: 2 },
  metaLbl:     { fontSize: 6.5, color: MUTED, letterSpacing: 0.5 },
  metaVal:     { fontSize: 7.5, color: INK, fontWeight: "bold" },

  // ── kpi grid ────────────────────────────────────────────────────────────
  kpiWrap:   { paddingHorizontal: 32, paddingVertical: 14, borderBottomWidth: 0.75, borderBottomColor: RULE },
  kpiRow:    { flexDirection: "row", gap: 8 },
  kpiCard:   { flex: 1, borderWidth: 0.75, borderColor: RULE, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: STRIP },
  kpiLabel:  { fontSize: 6.5, color: MUTED, letterSpacing: 0.8, marginBottom: 5 },
  kpiValue:  { fontSize: 14, fontWeight: "bold", color: INK },
  kpiWarn:   { color: BAD },

  // ── two-col cards ───────────────────────────────────────────────────────
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

  // ── financial summary card ───────────────────────────────────────────────
  finRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5.5, borderBottomWidth: 0.5, borderBottomColor: RULE },
  finRowLast: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5.5 },
  finLabel:   { fontSize: 8, color: MUTED },
  finValue:   { fontSize: 8, color: INK, fontWeight: "bold" },
  finWarn:    { fontSize: 8, color: BAD, fontWeight: "bold" },

  // ── page 2 tables ────────────────────────────────────────────────────────
  secHead:   { paddingHorizontal: 32, paddingTop: 16, paddingBottom: 8 },
  secTitle:  { fontSize: 8, fontWeight: "bold", color: BRAND, letterSpacing: 1.5 },
  tableWrap: { paddingHorizontal: 32 },
  thead:     { flexDirection: "row", backgroundColor: BRAND, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 4, marginBottom: 1 },
  th:        { fontSize: 7, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  tr:        { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: RULE },

  divider: { borderTopWidth: 0.75, borderTopColor: RULE, marginHorizontal: 32, marginTop: 20, marginBottom: 4 },

  // ── footer ───────────────────────────────────────────────────────────────
  footer:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: DARK, paddingVertical: 12, paddingHorizontal: 32 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerBrand: { fontSize: 7.5, fontWeight: "bold", color: WHITE },
  footerText:  { fontSize: 6.5, color: "#9CA3AF" },
});

const ADDR = "32 Thirumoorthy Layout, RS Puram, Coimbatore 641002";

export interface ReportPdfProps {
  periodLabel:  string;
  generatedAt:  string;
  logoSrc?:     string;
  kpi: {
    revenue:        string;
    collections:    string;
    outstanding:    string;
    outstandingWarn: boolean;
    activeProjects: number;
    newLeads:       number;
    readyToInstall: number;
  };
  leads:      { label: string; won: number; total: number; convPct: string }[];
  ageing:     { label: string; count: number; amount: string; fromDays: number; hasAmount: boolean }[];
  topClients: { name: string; invoiceCount: number; revenue: string }[];
  margins:    { number: string; name: string; clientName: string; orderValue: string; margin: string; marginPct: string; positive: boolean }[];
  categories: { family: string; revenue: string; margin: string; marginPct: string; positive: boolean }[];
}

export function ReportPdf({ periodLabel, generatedAt, logoSrc, kpi, leads, ageing, topClients, margins, categories }: ReportPdfProps) {
  const kpiRow1 = [
    { label: "REVENUE (EX-GST)", value: kpi.revenue,     warn: false },
    { label: "COLLECTIONS",      value: kpi.collections, warn: false },
    { label: "OUTSTANDING",      value: kpi.outstanding, warn: kpi.outstandingWarn },
  ];
  const kpiRow2 = [
    { label: "ACTIVE PROJECTS", value: String(kpi.activeProjects),  warn: false },
    { label: "NEW LEADS",       value: String(kpi.newLeads),        warn: false },
    { label: "ORDERS IN MAKE",  value: String(kpi.readyToInstall),  warn: false },
  ];

  return (
    <Document title={`Mandovara Report — ${periodLabel}`} author="Mandovara" creator="Mandovara Interior OS">

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 1 — EXECUTIVE SUMMARY
      ══════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.stripe} />

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ width: 200 }}>
            {logoSrc
              ? <Image src={logoSrc} style={s.logoImg} />
              : <Text style={{ fontSize: 18, fontWeight: "bold", color: BRAND }}>Mandovara</Text>
            }
            <Text style={s.logoTagline}>INTERIORS · COIMBATORE</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportEye}>BUSINESS REPORT</Text>
            <Text style={s.reportTitle}>{periodLabel}</Text>
            <View style={s.metaRow}><Text style={s.metaLbl}>GENERATED</Text><Text style={s.metaVal}>{generatedAt}</Text></View>
          </View>
        </View>

        {/* ── KPI Grid ────────────────────────────────────────────────── */}
        <View style={s.kpiWrap}>
          <View style={[s.kpiRow, { marginBottom: 8 }]}>
            {kpiRow1.map((k) => (
              <View key={k.label} style={s.kpiCard}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={[s.kpiValue, k.warn ? s.kpiWarn : {}]}>{k.value}</Text>
              </View>
            ))}
          </View>
          <View style={s.kpiRow}>
            {kpiRow2.map((k) => (
              <View key={k.label} style={s.kpiCard}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={s.kpiValue}>{k.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Row 1: Leads | Ageing ───────────────────────────────────── */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <View style={s.cardWrap}>
              <View style={s.cardHead}><Text style={s.cardHeadText}>LEADS BY SOURCE</Text></View>
              <View style={s.cardBody}>
                {leads.length === 0
                  ? <Text style={s.empty}>No leads yet.</Text>
                  : leads.map((r, i) => (
                    <View key={r.label} style={i === leads.length - 1 ? s.rowLast : s.row}>
                      <Text style={s.tdf}>{r.label}</Text>
                      <Text style={s.tdCount}>{r.won}/{r.total}</Text>
                      <Text style={s.tdPct}>{r.convPct}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>

          <View style={s.col}>
            <View style={s.cardWrap}>
              <View style={s.cardHead}><Text style={s.cardHeadText}>INVOICE AGEING</Text></View>
              <View style={s.cardBody}>
                {ageing.map((b, i) => (
                  <View key={b.label} style={i === ageing.length - 1 ? s.rowLast : s.row}>
                    <Text style={s.tdf}>{b.label}</Text>
                    <Text style={s.tdCount}>{b.count}</Text>
                    <Text style={[s.tdMoney, b.fromDays > 0 && b.hasAmount ? { color: BAD } : {}]}>
                      {b.hasAmount ? b.amount : "—"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ── Row 2: Top Clients | Financial Summary ───────────────────── */}
        <View style={[s.twoCol, { marginTop: 10 }]}>
          <View style={s.col}>
            <View style={s.cardWrap}>
              <View style={s.cardHead}><Text style={s.cardHeadText}>TOP CLIENTS BY REVENUE</Text></View>
              <View style={s.cardBody}>
                {topClients.length === 0
                  ? <Text style={s.empty}>No invoices yet.</Text>
                  : topClients.slice(0, 6).map((c, i) => (
                    <View key={c.name} style={i === Math.min(topClients.length, 6) - 1 ? s.rowLast : s.row}>
                      <Text style={s.tdf}>{c.name}</Text>
                      <Text style={s.tdCount}>{c.invoiceCount}</Text>
                      <Text style={s.tdMoney}>{c.revenue}</Text>
                    </View>
                  ))}
              </View>
            </View>
          </View>

          <View style={s.col}>
            <View style={s.cardWrap}>
              <View style={s.cardHead}><Text style={s.cardHeadText}>FINANCIAL SUMMARY</Text></View>
              <View style={s.cardBody}>
                <View style={s.finRow}>
                  <Text style={s.finLabel}>Revenue (Ex-GST)</Text>
                  <Text style={s.finValue}>{kpi.revenue}</Text>
                </View>
                <View style={s.finRow}>
                  <Text style={s.finLabel}>Collected (Receipts)</Text>
                  <Text style={s.finValue}>{kpi.collections}</Text>
                </View>
                <View style={s.finRowLast}>
                  <Text style={s.finLabel}>Outstanding</Text>
                  <Text style={kpi.outstandingWarn ? s.finWarn : s.finValue}>{kpi.outstanding}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerBrand}>mandovara.com</Text>
            <Text style={s.footerText}>{ADDR}</Text>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════════════════
          PAGE 2 — PROJECT PIPELINE + REVENUE BY CATEGORY
      ══════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={s.page}>
        <View style={s.stripe} />

        {/* ── Project Pipeline ────────────────────────────────────────── */}
        <View style={s.secHead}>
          <Text style={s.secTitle}>PROJECT PIPELINE</Text>
        </View>
        <View style={s.tableWrap}>
          <View style={s.thead}>
            <Text style={[s.th, { width: 64 }]}>#</Text>
            <Text style={[s.th, { flex: 1 }]}>PROJECT</Text>
            <Text style={[s.th, { flex: 1 }]}>CLIENT</Text>
            <Text style={[s.th, { width: 88, textAlign: "right" }]}>ORDER VALUE</Text>
            <Text style={[s.th, { width: 88, textAlign: "right" }]}>MARGIN</Text>
            <Text style={[s.th, { width: 38, textAlign: "right" }]}>%</Text>
          </View>
          {margins.length === 0
            ? <Text style={[s.empty, { paddingTop: 14 }]}>No projects yet.</Text>
            : margins.map((prj) => (
              <View key={prj.number} style={s.tr}>
                <Text style={{ width: 64, fontSize: 7.5, color: MUTED }}>{prj.number.split("/").pop()}</Text>
                <Text style={{ flex: 1, fontSize: 8, color: INK }}>{prj.name}</Text>
                <Text style={{ flex: 1, fontSize: 8, color: MUTED }}>{prj.clientName}</Text>
                <Text style={{ width: 88, textAlign: "right", fontSize: 8, color: INK }}>{prj.orderValue}</Text>
                <Text style={{ width: 88, textAlign: "right", fontSize: 8, color: prj.positive ? GOOD : BAD }}>{prj.margin}</Text>
                <Text style={{ width: 38, textAlign: "right", fontSize: 7.5, color: prj.positive ? GOOD : BAD }}>{prj.marginPct}</Text>
              </View>
            ))}
        </View>

        <View style={s.divider} />

        {/* ── Revenue by Category ─────────────────────────────────────── */}
        <View style={s.secHead}>
          <Text style={s.secTitle}>REVENUE BY CATEGORY</Text>
        </View>
        <View style={s.tableWrap}>
          <View style={s.thead}>
            <Text style={[s.th, { flex: 1 }]}>CATEGORY</Text>
            <Text style={[s.th, { width: 104, textAlign: "right" }]}>REVENUE</Text>
            <Text style={[s.th, { width: 104, textAlign: "right" }]}>MARGIN</Text>
            <Text style={[s.th, { width: 44, textAlign: "right" }]}>%</Text>
          </View>
          {categories.length === 0
            ? <Text style={[s.empty, { paddingTop: 14 }]}>No category data yet.</Text>
            : categories.map((c) => (
              <View key={c.family} style={s.tr}>
                <Text style={{ flex: 1, fontSize: 8, color: INK }}>{c.family.charAt(0) + c.family.slice(1).toLowerCase()}</Text>
                <Text style={{ width: 104, textAlign: "right", fontSize: 8, color: INK }}>{c.revenue}</Text>
                <Text style={{ width: 104, textAlign: "right", fontSize: 8, color: c.positive ? GOOD : BAD }}>{c.margin}</Text>
                <Text style={{ width: 44, textAlign: "right", fontSize: 7.5, color: c.positive ? GOOD : BAD }}>{c.marginPct}</Text>
              </View>
            ))}
        </View>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerBrand}>mandovara.com</Text>
            <Text style={s.footerText}>{ADDR}</Text>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>

    </Document>
  );
}
