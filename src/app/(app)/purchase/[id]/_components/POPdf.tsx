// Server-side PO PDF, styled to match QuotePdf.
// Built-in fonts only (Helvetica / Courier) — no external font downloads.
// Rupee amounts use "Rs." prefix (Helvetica does not include U+20B9).

import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { PODetail, POLineRow } from "@/modules/purchase/queries";

const TEAL   = "#1B8A7E";
const WHITE  = "#FFFFFF";
const INK    = "#111827";
const MUTED  = "#64748B";
const BORD   = "#E2E8F0";
const STRIP  = "#F8FAFC";

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

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: TEAL },
  logoBox: { width: 34, height: 34, backgroundColor: TEAL, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  logoM: { color: WHITE, fontSize: 20, fontFamily: "Helvetica-Bold" },
  brandCol: { marginLeft: 8, justifyContent: "center" },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 0.3 },
  brandSub: { fontSize: 6.5, color: MUTED, letterSpacing: 2, marginTop: 3 },
  docLabel: { textAlign: "right" },
  docTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.5 },
  docNum: { fontSize: 8.5, color: MUTED, fontFamily: "Courier", marginTop: 3 },

  metaStrip: { flexDirection: "row", backgroundColor: STRIP, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: BORD, borderRadius: 3 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 1, marginBottom: 3 },
  metaValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  addrRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  addrBox: { flex: 1, borderWidth: 1, borderColor: BORD, borderRadius: 3, padding: 10, backgroundColor: STRIP },
  addrTitle: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.2, marginBottom: 6 },
  addrName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 2 },
  addrLine: { fontSize: 7.5, color: MUTED, marginTop: 1 },

  tableWrap: { marginBottom: 12 },
  thead: { flexDirection: "row", backgroundColor: TEAL, paddingVertical: 5 },
  th: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 0.8 },
  tr: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: BORD },
  tdCenter: { fontSize: 8, color: MUTED, textAlign: "center" },
  tdLeft: { fontSize: 8 },
  tdRight: { fontSize: 8, fontFamily: "Courier", textAlign: "right" },
  tdMuted: { fontSize: 7, color: MUTED, marginTop: 1 },

  cNo:   { width: 20, paddingHorizontal: 4 },
  cDesc: { flex: 1, paddingHorizontal: 5 },
  cQty:  { width: 70, paddingHorizontal: 4 },
  cRate: { width: 90, paddingHorizontal: 4 },
  cAmt:  { width: 100, paddingHorizontal: 4 },

  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: TEAL, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 3, marginTop: 8, alignSelf: "flex-end", width: 260 },
  grandLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 1 },
  grandValue: { fontSize: 13, fontFamily: "Courier-Bold", color: WHITE },

  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: BORD, paddingTop: 6 },
  footerText: { fontSize: 7, color: MUTED },
});

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

function lineAmount(l: POLineRow): bigint {
  // rate is paise per unit; quantity is a decimal string.
  const qtyMilli = BigInt(Math.round(Number(l.orderedQty) * 10_000));
  return (l.rate * qtyMilli) / 10_000n;
}

function TableHeader() {
  return (
    <View style={s.thead}>
      <View style={s.cNo}><Text style={[s.th, { textAlign: "center" }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>Colourway</Text></View>
      <View style={s.cQty}><Text style={[s.th, { textAlign: "right" }]}>Qty</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right" }]}>Rate</Text></View>
      <View style={s.cAmt}><Text style={[s.th, { textAlign: "right" }]}>Amount</Text></View>
    </View>
  );
}

function TableRow({ line, idx }: { line: POLineRow; idx: number }) {
  const bg = idx % 2 === 1 ? STRIP : WHITE;
  const unitStr = UNIT_SHORT[line.unit] ?? line.unit.toLowerCase();
  const qty = Number(line.orderedQty);
  return (
    <View style={[s.tr, { backgroundColor: bg }]} wrap={false}>
      <View style={s.cNo}><Text style={s.tdCenter}>{idx + 1}</Text></View>
      <View style={s.cDesc}>
        <Text style={s.tdLeft}>{line.colourwayCode}</Text>
        <Text style={s.tdMuted}>{line.colourName} · {line.designCode}</Text>
      </View>
      <View style={s.cQty}>
        <Text style={[s.tdRight, { fontFamily: "Courier" }]}>{qty} {unitStr}</Text>
      </View>
      <View style={s.cRate}><Text style={s.tdRight}>{fmtMoney(line.rate)}</Text></View>
      <View style={s.cAmt}><Text style={[s.tdRight, { fontFamily: "Courier-Bold" }]}>{fmtMoney(lineAmount(line))}</Text></View>
    </View>
  );
}

export function POPdf({ po }: { po: PODetail }) {
  return (
    <Document title={`Purchase Order ${po.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.logoBox}><Text style={s.logoM}>M</Text></View>
            <View style={s.brandCol}>
              <Text style={s.brandName}>Mandovara</Text>
              <Text style={s.brandSub}>INTERIORS  ·  COIMBATORE</Text>
            </View>
          </View>
          <View style={s.docLabel}>
            <Text style={s.docTitle}>PURCHASE ORDER</Text>
            <Text style={s.docNum}>{po.number}</Text>
          </View>
        </View>

        <View style={s.metaStrip}>
          {[
            { label: "PO NO.", value: po.number, mono: true },
            { label: "DATE", value: fmtDate(po.date) },
            { label: "EXPECTED BY", value: po.expectedAt ? fmtDate(po.expectedAt) : "—" },
            { label: "STATUS", value: po.status },
          ].map(({ label, value, mono }) => (
            <View key={label} style={s.metaCol}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={[s.metaValue, mono ? { fontFamily: "Courier-Bold" } : {}]}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={s.addrRow}>
          <View style={s.addrBox}>
            <Text style={s.addrTitle}>TO (VENDOR)</Text>
            <Text style={s.addrName}>{po.vendorName}</Text>
            <Text style={s.addrLine}>{po.vendorMobile}</Text>
          </View>
          <View style={s.addrBox}>
            <Text style={s.addrTitle}>FROM</Text>
            <Text style={s.addrName}>Mandovara</Text>
            <Text style={s.addrLine}>32 Thirumoorthy Layout, Thadagam Rd</Text>
            <Text style={s.addrLine}>RS Puram, Coimbatore 641002</Text>
          </View>
        </View>

        <View style={s.tableWrap}>
          <TableHeader />
          {po.lines.map((l, i) => <TableRow key={l.id} line={l} idx={i} />)}
        </View>

        <View style={s.grandRow} wrap={false}>
          <Text style={s.grandLabel}>TOTAL</Text>
          <Text style={s.grandValue}>{fmtMoney(po.totalValue)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>mandovara.com  ·  +91 8940430051</Text>
          <Text style={s.footerText}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  );
}
