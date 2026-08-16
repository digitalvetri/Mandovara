// Server-side quotation PDF — @react-pdf/renderer.
// Fonts: GeistRegular (normal, has ₹ U+20B9) + NotoSans-Bold (bold, has ₹).

import path from "path";
import { Document, Page, View, Text, Image, Font, StyleSheet } from "@react-pdf/renderer";
import type { QuotationDetail, QuotationLine } from "@/modules/quotations/queries";

// ── fonts ──────────────────────────────────────────────────────────────────
const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold"  },
  ],
});

// ── colours ────────────────────────────────────────────────────────────────
const BRAND  = "#1B8A7E";
const BRANDL = "#E8F5F4";   // light teal tint
const WHITE  = "#FFFFFF";
const INK    = "#111827";
const MUTED  = "#6B7280";
const RULE   = "#E5E7EB";
const STRIP  = "#F9FAFB";

// ── usable width: 595 − 64 = 531pt ────────────────────────────────────────
const s = StyleSheet.create({
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
  const a = neg ? -p : p;
  const r = a / 100n;
  const raw = r.toString();
  const grp = raw.length <= 3 ? raw
    : raw.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + raw.slice(-3);
  return neg ? `(₹${grp})` : `₹${grp}`;
}

function gstRateLabel(cgst: bigint, taxable: bigint): string {
  if (taxable === 0n) return "";
  const rate = Math.round(Number(cgst * 10000n / taxable)) / 100;
  return `(${Number.isInteger(rate) ? rate : rate.toFixed(1)}%)`;
}

const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
  "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
function _w(x: number): string {
  if (x === 0) return "";
  if (x < 20) return ONES[x]!;
  if (x < 100) return (TENS[Math.floor(x/10)]! + (x%10 ? " "+ONES[x%10]! : "")).trim();
  return (ONES[Math.floor(x/100)]! + " Hundred" + (x%100 ? " "+_w(x%100) : "")).trim();
}
function toWords(rupees: bigint): string {
  const n = Number(rupees / 100n);
  if (n <= 0) return "Zero Rupees Only";
  const parts: string[] = [];
  let r = n;
  if (r >= 10000000) { parts.push(_w(Math.floor(r/10000000))+" Crore"); r%=10000000; }
  if (r >= 100000)   { parts.push(_w(Math.floor(r/100000))+" Lakh");    r%=100000; }
  if (r >= 1000)     { parts.push(_w(Math.floor(r/1000))+" Thousand");  r%=1000; }
  if (r > 0)         { parts.push(_w(r)); }
  return parts.join(" ") + " Only";
}

const DEFAULT_TERMS = [
  "Quotation is valid until the date mentioned above.",
  "Prices are subject to the terms mentioned in this quotation.",
  "Goods once sold will not be taken back.",
  "Installation & delivery will be as per the agreed schedule.",
];

// ── sub-components ─────────────────────────────────────────────────────────
function TH({ fixed: fx }: { fixed?: boolean }) {
  return (
    <View style={s.thead} fixed={fx}>
      <View style={s.cNo}  ><Text style={[s.th, { textAlign: "center" }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>DESCRIPTION / ROOM</Text></View>
      <View style={s.cQty} ><Text style={[s.th, { textAlign: "right"  }]}>QTY</Text></View>
      <View style={s.cUnit}><Text style={s.th}>UNIT</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right"  }]}>RATE (₹)</Text></View>
      <View style={s.cGst} ><Text style={[s.th, { textAlign: "right"  }]}>GST %</Text></View>
      <View style={s.cAmt} ><Text style={[s.th, { textAlign: "right"  }]}>AMOUNT (₹)</Text></View>
    </View>
  );
}

function TR({ line: l, idx }: { line: QuotationLine; idx: number }) {
  return (
    <View style={[s.tr, { backgroundColor: idx % 2 === 1 ? STRIP : WHITE }]} wrap={false}>
      <View style={s.cNo}  ><Text style={[s.tdLeft, { textAlign:"center", color: MUTED }]}>{idx+1}</Text></View>
      <View style={s.cDesc}>
        <Text style={s.tdLeft}>{l.description || "—"}</Text>
        {l.roomLabel  ? <Text style={s.tdMuted}>{l.roomLabel}</Text>  : null}
        {l.isOptional ? <Text style={s.tdOpt}>Optional</Text>         : null}
      </View>
      <View style={s.cQty} ><Text style={s.tdRight}>{parseFloat(l.quantity)}</Text></View>
      <View style={s.cUnit}><Text style={[s.tdLeft, { color: MUTED }]}>{U[l.unit] ?? l.unit.toLowerCase()}</Text></View>
      <View style={s.cRate}><Text style={s.tdRight}>{fm(l.rate)}</Text></View>
      <View style={s.cGst} ><Text style={[s.tdRight, { color: MUTED }]}>{l.gstRate}%</Text></View>
      <View style={s.cAmt} ><Text style={[s.tdRight, { fontWeight: "bold" }]}>{fm(l.amount)}</Text></View>
    </View>
  );
}

// ── main component ─────────────────────────────────────────────────────────
interface Props { quotation: QuotationDetail; logoSrc?: string }

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const isIntra  = q.cgst > 0n;
  const rateLabel = isIntra ? gstRateLabel(q.cgst, q.taxableAmount) : "";

  const taxRows: { label: string; v: bigint }[] = [
    { label: "Taxable Amount", v: q.taxableAmount },
    ...(isIntra
      ? [{ label: `CGST ${rateLabel}`, v: q.cgst }, { label: `SGST ${rateLabel}`, v: q.sgst }]
      : [{ label: "IGST", v: q.igst }]),
    ...(q.roundOff !== 0n ? [{ label: "Round-off", v: q.roundOff }] : []),
  ];

  const terms = q.termsText
    ? q.termsText.split("\n").filter(Boolean)
    : DEFAULT_TERMS;

  const avatarLetter = q.clientName.trim()[0]?.toUpperCase() ?? "M";

  return (
    <Document title={`Quotation ${q.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          {logoSrc
            ? <Image src={logoSrc} style={s.logoImg} />
            : (
              <View>
                <Text style={{ fontSize: 15, fontWeight: "bold", color: INK }}>Mandovara</Text>
                <Text style={{ fontSize: 6.5, color: MUTED, letterSpacing: 1.5, marginTop: 2 }}>INTERIORS · COIMBATORE</Text>
              </View>
            )
          }
          <View style={s.quotRight}>
            <Text style={s.quotTitle}>QUOTATION</Text>
            <Text style={s.quotNum}>{q.number}</Text>
            {q.revision > 0 && <Text style={s.quotRev}>Revision {q.revision}</Text>}
          </View>
        </View>

        {/* ── INFO STRIP ─────────────────────────────────────────────── */}
        <View style={s.infoStrip}>
          {[
            { label: "QUOTE NO.",    value: q.number },
            { label: "DATE",         value: fd(q.date) },
            { label: "VALID UNTIL",  value: fd(q.validUntil) },
            { label: "BRANCH",       value: q.branchName },
          ].map(({ label, value }) => (
            <View key={label} style={s.infoCol}>
              <Text style={s.infoLbl}>{label}</Text>
              <Text style={s.infoVal}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── CUSTOMER + TOTAL ROW ───────────────────────────────────── */}
        <View style={s.custRow}>
          <View style={s.custBox}>
            <View style={s.avatar}>
              <Text style={s.avatarLetter}>{avatarLetter}</Text>
            </View>
            <View style={s.custInfo}>
              <Text style={s.custName}>{q.clientName}</Text>
              <Text style={s.custLine}>{q.clientMobile}</Text>
              {q.clientEmail ? <Text style={s.custLine}>{q.clientEmail}</Text> : null}
              {q.clientGstin ? <Text style={s.custLine}>GSTIN: {q.clientGstin}</Text> : null}
              {q.projectName ? <Text style={s.custProject}>{q.projectName}</Text> : null}
            </View>
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLbl}>TOTAL AMOUNT</Text>
            <Text style={s.totalAmt}>{fm(q.total)}</Text>
            <Text style={s.totalIncl}>Includes GST</Text>
          </View>
        </View>

        {/* ── ITEMS TABLE ────────────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <TH fixed />
          {q.lines.map((l, i) => <TR key={l.id} line={l} idx={i} />)}
        </View>

        {/* ── AMOUNT IN WORDS + TAX SUMMARY ──────────────────────────── */}
        <View style={s.summaryRow} wrap={false}>
          <View style={s.wordsBox}>
            <Text style={s.wordsLbl}>AMOUNT IN WORDS</Text>
            <Text style={s.wordsText}>{toWords(q.total)}</Text>
          </View>
          <View style={s.totalsBox}>
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

        {/* ── TAX / SUPPLY INFO + TERMS ──────────────────────────────── */}
        <View style={s.bottomRow} wrap={false}>
          <View style={s.bottomCol}>
            <Text style={s.bottomSec}>TAX / SUPPLY INFORMATION</Text>
            {[
              { label: "Place of Supply", value: q.supplierStateCode === "33" ? "Tamil Nadu" : q.supplierStateCode },
              { label: "State Code",      value: q.supplierStateCode },
              { label: "Tax Type",        value: isIntra ? "Intra-state" : "Inter-state" },
              { label: "GST",             value: isIntra ? "CGST + SGST" : "IGST" },
            ].map(({ label, value }) => (
              <View key={label} style={s.bottomItem}>
                <Text style={s.bottomLbl}>{label}</Text>
                <Text style={s.bottomVal}>{value}</Text>
              </View>
            ))}
          </View>
          <View style={s.bottomCol}>
            <Text style={s.bottomSec}>TERMS &amp; CONDITIONS</Text>
            {terms.map((t, i) => (
              <Text key={i} style={s.termsBullet}>{"•"} {t}</Text>
            ))}
          </View>
        </View>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerText}>mandovara.com</Text>
            <Text style={s.footerText}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</Text>
            <Text style={s.footerText}>+91 8940430051</Text>
            <Text style={s.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </View>

      </Page>
    </Document>
  );
}
