// Server-rendered Tax Invoice PDF.
//
// Same visual language as QuotePdf (teal + Helvetica + Courier for
// numerals) so a client receiving quote → invoice back-to-back sees
// consistent branding. Built-in PDF fonts only (no download step).
//
// Rupee amounts use "Rs." prefix (Helvetica does not include U+20B9).

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { InvoiceDetail, InvoiceLineRow } from "@/modules/invoices/queries";

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
  logoImg: { width: 140, height: 140, objectFit: "contain" },
  logoTagline: { fontSize: 7, color: TEAL, letterSpacing: 2.5, marginTop: 5, textAlign: "center", fontFamily: "Helvetica-Bold" },
  logoFallbackBox: { width: 34, height: 34, backgroundColor: TEAL, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  logoFallbackM: { color: WHITE, fontSize: 20, fontFamily: "Helvetica-Bold" },
  brandCol: { marginLeft: 8, justifyContent: "center" },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 0.3 },
  brandSub: { fontSize: 6.5, color: MUTED, letterSpacing: 2, marginTop: 3 },
  docLabel: { textAlign: "right" },
  docTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.5 },
  docNum: { fontSize: 8.5, color: MUTED, fontFamily: "Courier", marginTop: 3 },
  docSub: { fontSize: 7.5, color: MUTED, marginTop: 2 },

  metaStrip: { flexDirection: "row", backgroundColor: STRIP, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: BORD, borderRadius: 3 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 6.5, color: MUTED, letterSpacing: 1, marginBottom: 3 },
  metaValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  addrRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  addrBox: { flex: 1, borderWidth: 1, borderColor: BORD, borderRadius: 3, padding: 10, backgroundColor: STRIP },
  addrTitle: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: TEAL, letterSpacing: 1.2, marginBottom: 6 },
  addrName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 2 },
  addrLine: { fontSize: 7.5, color: MUTED, marginTop: 1 },
  addrMono: { fontSize: 7.5, color: MUTED, fontFamily: "Courier", marginTop: 2 },

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
  cHsn:  { width: 42, paddingHorizontal: 3 },
  cQty:  { width: 52, paddingHorizontal: 3 },
  cRate: { width: 72, paddingHorizontal: 3 },
  cTax:  { width: 42, paddingHorizontal: 3 },
  cGst:  { width: 60, paddingHorizontal: 3 },
  cAmt:  { width: 78, paddingHorizontal: 3 },

  totalsWrap: { alignItems: "flex-end", marginBottom: 10 },
  totalsInner: { width: 240 },
  totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: BORD },
  totLabel: { fontSize: 8, color: MUTED },
  totValue: { fontSize: 8, fontFamily: "Courier" },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: TEAL, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 3, marginTop: 8 },
  grandLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: WHITE, letterSpacing: 1 },
  grandValue: { fontSize: 13, fontFamily: "Courier-Bold", color: WHITE },

  outstandingWrap: { marginTop: 8, borderTopWidth: 1, borderTopColor: BORD, paddingTop: 6 },

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
  const str = rupees.toString();
  const l3 = str.slice(-3);
  const grouped = str.length <= 3 ? str : str.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + l3;
  return neg ? `(Rs.${grouped})` : `Rs.${grouped}`;
}

function TableHeader({ isIntra }: { isIntra: boolean }) {
  return (
    <View style={s.thead}>
      <View style={s.cNo}><Text style={[s.th, { textAlign: "center" }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>Description</Text></View>
      <View style={s.cHsn}><Text style={s.th}>HSN</Text></View>
      <View style={s.cQty}><Text style={[s.th, { textAlign: "right" }]}>Qty</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right" }]}>Rate</Text></View>
      <View style={s.cTax}><Text style={[s.th, { textAlign: "right" }]}>Taxable</Text></View>
      {isIntra ? (
        <>
          <View style={s.cGst}><Text style={[s.th, { textAlign: "right" }]}>CGST</Text></View>
          <View style={s.cGst}><Text style={[s.th, { textAlign: "right" }]}>SGST</Text></View>
        </>
      ) : (
        <View style={s.cGst}><Text style={[s.th, { textAlign: "right" }]}>IGST</Text></View>
      )}
      <View style={s.cAmt}><Text style={[s.th, { textAlign: "right" }]}>Amount</Text></View>
    </View>
  );
}

function TableRow({ line, idx, isIntra }: { line: InvoiceLineRow; idx: number; isIntra: boolean }) {
  const bg = idx % 2 === 1 ? STRIP : WHITE;
  const unitStr = UNIT_SHORT[line.unit] ?? line.unit.toLowerCase();
  const qty = parseFloat(line.quantity);
  return (
    <View style={[s.tr, { backgroundColor: bg }]} wrap={false}>
      <View style={s.cNo}><Text style={s.tdCenter}>{line.lineNo}</Text></View>
      <View style={s.cDesc}><Text style={s.tdLeft}>{line.description || "—"}</Text></View>
      <View style={s.cHsn}><Text style={[s.tdRight, { color: MUTED }]}>{line.hsn}</Text></View>
      <View style={s.cQty}><Text style={[s.tdRight, { fontFamily: "Courier" }]}>{qty} {unitStr}</Text></View>
      <View style={s.cRate}><Text style={s.tdRight}>{fmtMoney(line.rate)}</Text></View>
      <View style={s.cTax}><Text style={s.tdRight}>{fmtMoney(line.taxable)}</Text></View>
      {isIntra ? (
        <>
          <View style={s.cGst}><Text style={s.tdRight}>{fmtMoney(line.cgst)}</Text></View>
          <View style={s.cGst}><Text style={s.tdRight}>{fmtMoney(line.sgst)}</Text></View>
        </>
      ) : (
        <View style={s.cGst}><Text style={s.tdRight}>{fmtMoney(line.igst)}</Text></View>
      )}
      <View style={s.cAmt}><Text style={[s.tdRight, { fontFamily: "Courier-Bold" }]}>{fmtMoney(line.amount)}</Text></View>
    </View>
  );
}

export function InvoicePdf({ invoice: i, logoSrc }: { invoice: InvoiceDetail; logoSrc?: string }) {
  const isIntra = i.supplierStateCode === i.placeOfSupplyCode;
  const taxRows: Array<{ label: string; v: bigint }> = [
    { label: "Taxable Amount", v: i.taxableAmount },
    ...(isIntra
      ? [{ label: "CGST", v: i.cgst }, { label: "SGST", v: i.sgst }]
      : [{ label: "IGST", v: i.igst }]),
    ...(i.roundOff !== 0n ? [{ label: "Round-off", v: i.roundOff }] : []),
  ];

  return (
    <Document title={`Tax Invoice ${i.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        <View style={s.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {logoSrc
              ? (
                <View style={{ flexDirection: "column", alignItems: "flex-start" }}>
                  <Image src={logoSrc} style={s.logoImg} />
                  <Text style={s.logoTagline}>INTERIORS · COIMBATORE</Text>
                </View>
              )
              : (
                <>
                  <View style={s.logoFallbackBox}><Text style={s.logoFallbackM}>M</Text></View>
                  <View style={s.brandCol}>
                    <Text style={s.brandName}>Mandovara</Text>
                    <Text style={s.brandSub}>INTERIORS  ·  COIMBATORE</Text>
                  </View>
                </>
              )
            }
          </View>
          <View style={s.docLabel}>
            <Text style={s.docTitle}>{i.type === "TAX" ? "TAX INVOICE" : i.type.replace(/_/g, " ")}</Text>
            <Text style={s.docNum}>{i.number}</Text>
            {i.orderNumber && <Text style={s.docSub}>Order {i.orderNumber}</Text>}
          </View>
        </View>

        <View style={s.metaStrip}>
          {[
            { label: "INVOICE NO.", value: i.number, mono: true },
            { label: "DATE", value: fmtDate(i.date) },
            { label: "DUE", value: fmtDate(i.dueDate) },
            { label: "STATUS", value: i.status },
          ].map(({ label, value, mono }) => (
            <View key={label} style={s.metaCol}>
              <Text style={s.metaLabel}>{label}</Text>
              <Text style={[s.metaValue, mono ? { fontFamily: "Courier-Bold" } : {}]}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={s.addrRow}>
          <View style={s.addrBox}>
            <Text style={s.addrTitle}>BILL TO</Text>
            <Text style={s.addrName}>{i.clientName}</Text>
            <Text style={s.addrLine}>{i.clientMobile}</Text>
            {i.clientGstin ? <Text style={s.addrMono}>GSTIN: {i.clientGstin}</Text> : null}
          </View>
          <View style={s.addrBox}>
            <Text style={s.addrTitle}>FROM</Text>
            <Text style={s.addrName}>{i.branchName}</Text>
            <Text style={s.addrLine}>32 Thirumoorthy Layout, Thadagam Rd</Text>
            <Text style={s.addrLine}>RS Puram, Coimbatore 641002</Text>
            <Text style={s.addrLine}>State code {i.supplierStateCode} · {isIntra ? "Intra-state" : "Inter-state"}</Text>
          </View>
        </View>

        <View style={s.tableWrap}>
          <TableHeader isIntra={isIntra} />
          {i.lines.map((l, idx) => <TableRow key={l.id} line={l} idx={idx} isIntra={isIntra} />)}
        </View>

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totalsInner}>
            {taxRows.map(({ label, v }) => (
              <View key={label} style={s.totRow}>
                <Text style={s.totLabel}>{label}</Text>
                <Text style={s.totValue}>{fmtMoney(v)}</Text>
              </View>
            ))}
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>INVOICE TOTAL</Text>
              <Text style={s.grandValue}>{fmtMoney(i.total)}</Text>
            </View>
            {(i.advanceAdjusted > 0n || i.paidTotal > 0n) && (
              <View style={s.outstandingWrap}>
                {i.advanceAdjusted > 0n && (
                  <View style={s.totRow}>
                    <Text style={s.totLabel}>Advance adjusted</Text>
                    <Text style={s.totValue}>{fmtMoney(i.advanceAdjusted)}</Text>
                  </View>
                )}
                {i.paidTotal > 0n && (
                  <View style={s.totRow}>
                    <Text style={s.totLabel}>Received</Text>
                    <Text style={s.totValue}>{fmtMoney(i.paidTotal)}</Text>
                  </View>
                )}
                <View style={s.totRow}>
                  <Text style={[s.totLabel, { fontFamily: "Helvetica-Bold", color: INK }]}>Outstanding</Text>
                  <Text style={[s.totValue, { fontFamily: "Courier-Bold", color: INK }]}>{fmtMoney(i.outstanding)}</Text>
                </View>
              </View>
            )}
          </View>
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
