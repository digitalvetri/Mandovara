// Server-side quotation PDF — @react-pdf/renderer.
// Fonts in public/fonts/ include U+20B9 (₹) — LiberationBold for bold weight.

import path from "path";
import { Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";
import type { QuotationDetail, QuotationLine } from "@/modules/quotations/queries";

// ── fonts ──────────────────────────────────────────────────────────────────
const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"),  fontWeight: "normal" },
    { src: path.join(FONTS, "LiberationBold.ttf"), fontWeight: "bold"   },
  ],
});

// ── colours ────────────────────────────────────────────────────────────────
const BRAND = "#1B8A7E";
const WHITE = "#FFFFFF";
const INK   = "#111827";
const MUTED = "#6B7280";
const RULE  = "#E5E7EB";
const STRIP = "#F9FAFB";

// ── styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: "Geist", fontSize: 9, color: INK, backgroundColor: WHITE,
          paddingTop: 28, paddingBottom: 44, paddingHorizontal: 32 },

  // Header: logo | QUOTATION
  header:    { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
               marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1.5, borderBottomColor: BRAND },
  logoImg:   { width: 130, height: 44, objectFit: "contain" },
  logoText:  { fontSize: 15, fontWeight: "bold", color: INK },
  logoSub:   { fontSize: 6.5, color: MUTED, letterSpacing: 1.5, marginTop: 2 },
  quotRight: { alignItems: "flex-end" },
  quotTitle: { fontSize: 20, fontWeight: "bold", color: BRAND, letterSpacing: 2 },
  quotNum:   { fontSize: 9, color: MUTED, marginTop: 4 },
  quotRev:   { fontSize: 7.5, color: MUTED, marginTop: 2 },

  // Info strip
  infoStrip: { flexDirection: "row", backgroundColor: STRIP, borderWidth: 0.75, borderColor: RULE,
               borderRadius: 3, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12 },
  infoCol:   { flex: 1 },
  infoLbl:   { fontSize: 6.5, color: MUTED, letterSpacing: 0.8, marginBottom: 2.5 },
  infoVal:   { fontSize: 8.5, fontWeight: "bold" },

  // Addresses
  addrRow:  { flexDirection: "row", gap: 10, marginBottom: 14 },
  addrBox:  { flex: 1, borderWidth: 0.75, borderColor: RULE, borderRadius: 3,
              padding: 10, backgroundColor: STRIP },
  addrSec:  { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 1.2, marginBottom: 5 },
  addrName: { fontSize: 9.5, fontWeight: "bold", color: INK, marginBottom: 2.5 },
  addrLine: { fontSize: 7.5, color: MUTED, marginTop: 1.5 },

  // Table
  tableWrap: { marginBottom: 12 },
  thead:     { flexDirection: "row", backgroundColor: BRAND, paddingVertical: 5 },
  th:        { fontSize: 6.5, fontWeight: "bold", color: WHITE, letterSpacing: 0.6 },
  tr:        { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 5 },
  tdLeft:    { fontSize: 8 },
  tdRight:   { fontSize: 8, textAlign: "right" },
  tdMuted:   { fontSize: 6.5, color: MUTED, marginTop: 1.5 },
  tdOpt:     { fontSize: 6.5, color: BRAND, marginTop: 1.5 },

  // Column widths (531pt usable = 595 − 64)
  cNo:   { width: 18, paddingHorizontal: 3 },
  cDesc: { flex: 1, paddingHorizontal: 5 },
  cQty:  { width: 38, paddingHorizontal: 3 },
  cUnit: { width: 28, paddingHorizontal: 3 },
  cRate: { width: 76, paddingHorizontal: 3 },
  cGst:  { width: 35, paddingHorizontal: 3 },
  cAmt:  { width: 76, paddingHorizontal: 3 },

  // Totals
  totalsWrap:  { alignItems: "flex-end", marginBottom: 10 },
  totalsInner: { width: 230 },
  totRow:      { flexDirection: "row", justifyContent: "space-between",
                 paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: RULE },
  totLbl:      { fontSize: 8, color: MUTED },
  totVal:      { fontSize: 8 },
  grandRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                 backgroundColor: BRAND, paddingVertical: 8, paddingHorizontal: 12,
                 borderRadius: 3, marginTop: 6 },
  grandLbl:    { fontSize: 8, fontWeight: "bold", color: WHITE, letterSpacing: 0.8 },
  grandVal:    { fontSize: 14, fontWeight: "bold", color: WHITE },

  // Terms
  termsWrap: { borderTopWidth: 0.75, borderTopColor: RULE, paddingTop: 8, marginTop: 4 },
  termsSec:  { fontSize: 6.5, fontWeight: "bold", color: BRAND, letterSpacing: 1, marginBottom: 4 },
  termsBody: { fontSize: 7.5, color: MUTED, lineHeight: 1.5 },

  // Footer
  footer:     { position: "absolute", bottom: 20, left: 32, right: 32,
                borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 5 },
  footerRow:  { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 6.5, color: MUTED },
});

// ── helpers ────────────────────────────────────────────────────────────────
const U: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

function fd(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function fm(p: bigint): string {
  const neg = p < 0n;
  const a   = neg ? -p : p;
  const r   = a / 100n;
  const raw = r.toString();
  const grp = raw.length <= 3
    ? raw
    : raw.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + raw.slice(-3);
  return neg ? `(₹${grp})` : `₹${grp}`;
}

// ── sub-components ────────────────────────────────────────────────────────
function TH() {
  return (
    <View style={s.thead}>
      <View style={s.cNo}  ><Text style={[s.th, { textAlign: "center" }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>DESCRIPTION / ROOM</Text></View>
      <View style={s.cQty} ><Text style={[s.th, { textAlign: "right"  }]}>QTY</Text></View>
      <View style={s.cUnit}><Text style={s.th}>UNIT</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right"  }]}>RATE</Text></View>
      <View style={s.cGst} ><Text style={[s.th, { textAlign: "right"  }]}>GST%</Text></View>
      <View style={s.cAmt} ><Text style={[s.th, { textAlign: "right"  }]}>AMOUNT</Text></View>
    </View>
  );
}

function TR({ line: l, idx }: { line: QuotationLine; idx: number }) {
  const bg = idx % 2 === 1 ? STRIP : WHITE;
  return (
    <View style={[s.tr, { backgroundColor: bg }]} wrap={false}>
      <View style={s.cNo}>
        <Text style={[s.tdLeft, { textAlign: "center", color: MUTED }]}>{idx + 1}</Text>
      </View>
      <View style={s.cDesc}>
        <Text style={s.tdLeft}>{l.description || "—"}</Text>
        {l.roomLabel   ? <Text style={s.tdMuted}>{l.roomLabel}</Text>   : null}
        {l.isOptional  ? <Text style={s.tdOpt}>Optional</Text>          : null}
      </View>
      <View style={s.cQty} ><Text style={[s.tdRight]}>{parseFloat(l.quantity)}</Text></View>
      <View style={s.cUnit}><Text style={[s.tdLeft, { color: MUTED }]}>{U[l.unit] ?? l.unit.toLowerCase()}</Text></View>
      <View style={s.cRate}><Text style={s.tdRight}>{fm(l.rate)}</Text></View>
      <View style={s.cGst} ><Text style={[s.tdRight, { color: MUTED }]}>{l.gstRate}%</Text></View>
      <View style={s.cAmt} ><Text style={[s.tdRight, { fontWeight: "bold" }]}>{fm(l.amount)}</Text></View>
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────
interface Props { quotation: QuotationDetail; logoSrc?: string }

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const isIntra = q.cgst > 0n;

  const taxRows: { label: string; v: bigint }[] = [
    { label: "Taxable Amount", v: q.taxableAmount },
    ...(isIntra
      ? [{ label: "CGST", v: q.cgst }, { label: "SGST", v: q.sgst }]
      : [{ label: "IGST", v: q.igst }]),
    ...(q.roundOff !== 0n ? [{ label: "Round-off", v: q.roundOff }] : []),
  ];

  return (
    <Document title={`Quotation ${q.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            {logoSrc
              ? <Image src={logoSrc} style={s.logoImg} />
              : (
                <View>
                  <Text style={s.logoText}>Mandovara</Text>
                  <Text style={s.logoSub}>INTERIORS  ·  COIMBATORE</Text>
                </View>
              )
            }
          </View>
          <View style={s.quotRight}>
            <Text style={s.quotTitle}>QUOTATION</Text>
            <Text style={s.quotNum}>{q.number}</Text>
            {q.revision > 0 && <Text style={s.quotRev}>Revision {q.revision}</Text>}
          </View>
        </View>

        {/* ── INFO STRIP ─────────────────────────────────────────────── */}
        <View style={s.infoStrip}>
          {[
            { label: "QUOTE NO.", value: q.number },
            { label: "DATE",      value: fd(q.date) },
            { label: "VALID UNTIL", value: fd(q.validUntil) },
            { label: "BRANCH",    value: q.branchName },
          ].map(({ label, value }) => (
            <View key={label} style={s.infoCol}>
              <Text style={s.infoLbl}>{label}</Text>
              <Text style={s.infoVal}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── BILL TO / FROM ─────────────────────────────────────────── */}
        <View style={s.addrRow}>
          <View style={s.addrBox}>
            <Text style={s.addrSec}>BILL TO</Text>
            <Text style={s.addrName}>{q.clientName}</Text>
            <Text style={s.addrLine}>{q.clientMobile}</Text>
            {q.clientEmail  ? <Text style={s.addrLine}>{q.clientEmail}</Text> : null}
            {q.clientGstin  ? <Text style={s.addrLine}>GSTIN: {q.clientGstin}</Text> : null}
          </View>
          <View style={s.addrBox}>
            <Text style={s.addrSec}>FROM</Text>
            <Text style={s.addrName}>{q.branchName}</Text>
            <Text style={s.addrLine}>32 Thirumoorthy Layout, Thadagam Road</Text>
            <Text style={s.addrLine}>RS Puram, Coimbatore 641002</Text>
            <Text style={s.addrLine}>+91 8940430051  ·  mandovara22@gmail.com</Text>
            <Text style={s.addrLine}>State code {q.supplierStateCode}  ·  {isIntra ? "Intra-state" : "Inter-state"}</Text>
          </View>
        </View>

        {/* ── ITEMS TABLE ────────────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <TH />
          {q.lines.map((l, i) => <TR key={l.id} line={l} idx={i} />)}
        </View>

        {/* ── TAX SUMMARY ────────────────────────────────────────────── */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totalsInner}>
            {taxRows.map(({ label, v }) => (
              <View key={label} style={s.totRow}>
                <Text style={s.totLbl}>{label}</Text>
                <Text style={s.totVal}>{fm(v)}</Text>
              </View>
            ))}
            <View style={s.grandRow}>
              <Text style={s.grandLbl}>GRAND TOTAL</Text>
              <Text style={s.grandVal}>{fm(q.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── TERMS ──────────────────────────────────────────────────── */}
        {q.termsText ? (
          <View style={s.termsWrap} wrap={false}>
            <Text style={s.termsSec}>TERMS &amp; CONDITIONS</Text>
            <Text style={s.termsBody}>{q.termsText}</Text>
          </View>
        ) : null}

        {/* ── FOOTER (every page) ────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerText}>mandovara.com  ·  +91 8940430051</Text>
            <Text style={s.footerText}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</Text>
            <Text
              style={s.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>

      </Page>
    </Document>
  );
}
