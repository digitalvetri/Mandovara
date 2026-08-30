import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { s, ADDR, BRAND, INK, MUTED, GOOD, BAD } from "./ReportPdfStyles";

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
    <Document title={`Mandovara Report — ${periodLabel}`} author="Mandovara" creator="Mandovara">

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
