// Server-side PDF component rendered by @react-pdf/renderer.
// Uses built-in PDF fonts (Helvetica / Courier) — no external font downloads.
// Rupee amounts use "Rs." prefix (Helvetica does not include U+20B9).

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { QuotationDetail, QuotationLine } from "@/modules/quotations/queries";

// ── colours ────────────────────────────────────────────────────────────────
const TEAL   = "#1B8A7E";
const WHITE  = "#FFFFFF";
const INK    = "#111827";
const MUTED  = "#64748B";
const BORD   = "#E2E8F0";
const STRIP  = "#F8FAFC";
const THEAD  = "#1B8A7E"; // same as TEAL

// ── styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
    backgroundColor: WHITE,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 32,
  },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: TEAL },
  logoBox: { width: 34, height: 34, backgroundColor: TEAL, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  logoM: { color: WHITE, fontSize: 20, fontFamily: "Helvetica-Bold" },
  brandCol: { marginLeft: 8, justifyContent: "center" },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 0.3 },
  brandSub: { fontSize: 6.5, color: MUTED, letterSpacing: 2, marginTop: 3 },
  quotLabel: { textAlign: "right" },
  quotTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.5 },
  quotNum: { fontSize: 8.5, color: MUTED, fontFamily: "Courier", marginTop: 3 },
  quotRev: { fontSize: 7.5, color: MUTED, marginTop: 2 },

  // Meta strip
  metaStrip: { flexDirection: "row", backgroundColor: STRIP, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: BORD, borderRadius: 3 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 1, marginBottom: 3 },
  metaValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // Bill To / From
  addrRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  addrBox: { flex: 1, borderWidth: 1, borderColor: BORD, borderRadius: 3, padding: 10, backgroundColor: STRIP },
  addrTitle: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.2, marginBottom: 6 },
  addrName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 2 },
  addrLine: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  addrMono: { fontSize: 7.5, color: MUTED, fontFamily: "Courier", marginTop: 2 },

  // Table
  tableWrap: { marginBottom: 12 },
  thead: { flexDirection: "row", backgroundColor: THEAD, paddingVertical: 5, paddingHorizontal: 0 },
  th: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.8 },
  tr: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: BORD },
  tdCenter: { fontSize: 8, color: MUTED, textAlign: "center" },
  tdLeft: { fontSize: 8 },
  tdRight: { fontSize: 8, fontFamily: "Courier", textAlign: "right" },
  tdMuted: { fontSize: 7, color: MUTED, marginTop: 1 },
  tdOptional: { fontSize: 7, color: TEAL, marginTop: 1 },

  // Col widths (of 531pt usable width = 595 - 64 margins)
  cNo:   { width: 20, paddingHorizontal: 4 },
  cDesc: { flex: 1, paddingHorizontal: 5 },
  cQty:  { width: 55, paddingHorizontal: 4 },
  cRate: { width: 88, paddingHorizontal: 4 },
  cGst:  { width: 40, paddingHorizontal: 4 },
  cAmt:  { width: 90, paddingHorizontal: 4 },

  // Totals
  totalsWrap: { alignItems: "flex-end", marginBottom: 10 },
  totalsInner: { width: 215 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: BORD },
  totLabel: { fontSize: 8, color: MUTED },
  totValue: { fontSize: 8, fontFamily: "Courier" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: TEAL, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 3, marginTop: 8 },
  grandLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 1 },
  grandValue: { fontSize: 13, fontFamily: "Courier-Bold", color: WHITE },

  // Terms
  termsWrap: { borderTopWidth: 1, borderTopColor: BORD, paddingTop: 10, marginTop: 4 },
  termsTitle: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.2, marginBottom: 5 },
  termsBody: { fontSize: 7.5, color: MUTED, lineHeight: 1.6 },

  // Footer
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: BORD, paddingTop: 6 },
  footerText: { fontSize: 7, color: MUTED },
});

// ── helpers ────────────────────────────────────────────────────────────────
const UNIT_SHORT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function fmtMoney(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const rupees = abs / 100n;
  const s = rupees.toString();
  const l3 = s.slice(-3);
  const grouped = s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + l3;
  return neg ? `(Rs.${grouped})` : `Rs.${grouped}`;
}

function lineAmtPaise(l: QuotationLine): bigint {
  return l.amount; // already in paise from DB
}

// ── sub-components ────────────────────────────────────────────────────────
function TableHeader() {
  return (
    <View style={s.thead}>
      <View style={s.cNo}><Text style={[s.th, { textAlign: "center" }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>Description</Text></View>
      <View style={s.cQty}><Text style={[s.th, { textAlign: "right" }]}>Qty</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right" }]}>Rate</Text></View>
      <View style={s.cGst}><Text style={[s.th, { textAlign: "right" }]}>GST%</Text></View>
      <View style={s.cAmt}><Text style={[s.th, { textAlign: "right" }]}>Amount</Text></View>
    </View>
  );
}

function TableRow({ line, idx }: { line: QuotationLine; idx: number }) {
  const bg = idx % 2 === 1 ? STRIP : WHITE;
  const unitStr = UNIT_SHORT[line.unit] ?? line.unit.toLowerCase();
  const qty = parseFloat(line.quantity);
  return (
    <View style={[s.tr, { backgroundColor: bg }]} wrap={false}>
      <View style={s.cNo}><Text style={s.tdCenter}>{idx + 1}</Text></View>
      <View style={s.cDesc}>
        <Text style={s.tdLeft}>{line.description || "—"}</Text>
        {line.roomLabel ? <Text style={s.tdMuted}>{line.roomLabel}</Text> : null}
        {line.isOptional ? <Text style={s.tdOptional}>Optional</Text> : null}
      </View>
      <View style={s.cQty}>
        <Text style={[s.tdRight, { fontFamily: "Courier" }]}>{qty} {unitStr}</Text>
      </View>
      <View style={s.cRate}>
        <Text style={s.tdRight}>{fmtMoney(line.rate)}</Text>
      </View>
      <View style={s.cGst}>
        <Text style={[s.tdRight, { color: MUTED }]}>{line.gstRate}%</Text>
      </View>
      <View style={s.cAmt}>
        <Text style={[s.tdRight, { fontFamily: "Courier-Bold" }]}>{fmtMoney(lineAmtPaise(line))}</Text>
      </View>
    </View>
  );
}

// ── main component ────────────────────────────────────────────────────────
interface Props { quotation: QuotationDetail }

export function QuotePdf({ quotation: q }: Props) {
  const isIntraState = q.cgst > 0n;

  const taxRows: Array<{ label: string; v: bigint }> = [
    { label: "Taxable Amount", v: q.taxableAmount },
    ...(isIntraState
      ? [{ label: "CGST", v: q.cgst }, { label: "SGST", v: q.sgst }]
      : [{ label: "IGST", v: q.igst }]),
    ...(q.roundOff !== 0n ? [{ label: "Round-off", v: q.roundOff }] : []),
  ];

  return (
    <Document title={`Quotation ${q.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.logoBox}><Text style={s.logoM}>M</Text></View>
            <View style={s.brandCol}>
              <Text style={s.brandName}>Mandovara</Text>
              <Text style={s.brandSub}>INTERIORS  ·  COIMBATORE</Text>
            </View>
          </View>
          <View style={s.quotLabel}>
            <Text style={s.quotTitle}>QUOTATION</Text>
            <Text style={s.quotNum}>{q.number}</Text>
            {q.revision > 0 && <Text style={s.quotRev}>Revision {q.revision}</Text>}
          </View>
        </View>

        {/* ── META STRIP ── */}
        <View style={s.metaStrip}>
          {[
            { label: "QUOTE NO.", value: q.number, mono: true },
            { label: "DATE", value: fmtDate(q.date) },
            { label: "VALID UNTIL", value: fmtDate(q.validUntil) },
            { label: "BRANCH", value: q.branchName },
          ].map(({ label, value, mono }) => (
            <View key={label} style={s.metaCol}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={[s.metaValue, mono ? { fontFamily: "Courier-Bold" } : {}]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── BILL TO / FROM ── */}
        <View style={s.addrRow}>
          <View style={s.addrBox}>
            <Text style={s.addrTitle}>BILL TO</Text>
            <Text style={s.addrName}>{q.clientName}</Text>
            <Text style={s.addrLine}>{q.clientMobile}</Text>
            {q.clientEmail ? <Text style={s.addrLine}>{q.clientEmail}</Text> : null}
            {q.clientGstin ? <Text style={s.addrMono}>GSTIN: {q.clientGstin}</Text> : null}
          </View>
          <View style={s.addrBox}>
            <Text style={s.addrTitle}>FROM</Text>
            <Text style={s.addrName}>{q.branchName}</Text>
            <Text style={s.addrLine}>32 Thirumoorthy Layout, Thadagam Rd</Text>
            <Text style={s.addrLine}>RS Puram, Coimbatore 641002</Text>
            <Text style={s.addrLine}>State code {q.supplierStateCode} · {isIntraState ? "Intra-state" : "Inter-state"}</Text>
          </View>
        </View>

        {/* ── LINE ITEMS ── */}
        <View style={s.tableWrap}>
          <TableHeader />
          {q.lines.map((l, i) => <TableRow key={l.id} line={l} idx={i} />)}
        </View>

        {/* ── TOTALS ── */}
        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totalsInner}>
            {taxRows.map(({ label, v }) => (
              <View key={label} style={s.totRow}>
                <Text style={s.totLabel}>{label}</Text>
                <Text style={s.totValue}>{fmtMoney(v)}</Text>
              </View>
            ))}
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>GRAND TOTAL</Text>
              <Text style={s.grandValue}>{fmtMoney(q.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── TERMS ── */}
        {q.termsText ? (
          <View style={s.termsWrap} wrap={false}>
            <Text style={s.termsTitle}>TERMS &amp; CONDITIONS</Text>
            <Text style={s.termsBody}>{q.termsText}</Text>
          </View>
        ) : null}

        {/* ── FOOTER (fixed on every page) ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>mandovara.com  ·  +91 8940430051</Text>
          <Text style={s.footerText}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
