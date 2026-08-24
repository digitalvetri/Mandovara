// Server-side quotation PDF — @react-pdf/renderer.
// Fonts: GeistRegular (normal, has ₹ U+20B9) + NotoSans-Bold (bold, has ₹).

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { QuotationDetail } from "@/modules/quotations/queries";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import { rupeesToWords } from "./_words";
import { pdfStyles as s, BRAND } from "./_pdf-styles";
import { TH, TR, RoomHeader, fm } from "./_pdf-table";

// ── fonts ──────────────────────────────────────────────────────────────────
const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold"  },
  ],
});

// ── helpers ────────────────────────────────────────────────────────────────
function fd(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}
function gstHalf(cgst: bigint, taxable: bigint): string {
  if (taxable === 0n) return "";
  const r = Math.round(Number(cgst * 10000n / taxable)) / 100;
  return `(${Number.isInteger(r) ? r : r.toFixed(1)}%)`;
}

// ── constants ──────────────────────────────────────────────────────────────
const FROM = { name: "Mandovara", addr1: "32 Thirumoorthy Layout, Thadagam Road", addr2: "RS Puram, Coimbatore 641002", state: "Tamil Nadu (33), India", phone: "+91 89404 30051", email: "mandovara22@gmail.com" };
const STATUS_LABEL: Record<string, string> = { DRAFT: "DRAFT", SENT: "QUOTATION", REVISED: "REVISED", ACCEPTED: "ACCEPTED", REJECTED: "REJECTED", EXPIRED: "EXPIRED" };
const ESTIMATE_TERMS = [ESTIMATE_CAVEAT, "This estimate is indicative — a firm quotation follows site measurement.", "Estimate is valid until the date shown above."];
const DEFAULT_TERMS  = ["Quotation is valid until the date shown above.", "50% advance required to confirm the order.", "Balance payable before or on delivery / installation.", "Goods once delivered cannot be returned.", "Delivery timeline is as per the agreed schedule.", "All prices inclusive of GST."];

// ── main ───────────────────────────────────────────────────────────────────
interface Props { quotation: QuotationDetail; logoSrc?: string }

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const estimate   = isEstimate(q.lines);
  const isIntra    = q.cgst > 0n;
  const half       = isIntra ? gstHalf(q.cgst, q.taxableAmount) : "";
  const stateLabel = q.supplierStateCode === "33" ? "Tamil Nadu (33)" : q.supplierStateCode;
  const docLabel   = estimate ? "ESTIMATE" : (STATUS_LABEL[q.status] ?? "QUOTATION");
  const terms      = (() => {
    const base = q.termsText ? q.termsText.split("\n").filter(Boolean) : (estimate ? ESTIMATE_TERMS : DEFAULT_TERMS);
    return estimate && !base.includes(ESTIMATE_CAVEAT) ? [ESTIMATE_CAVEAT, ...base] : base;
  })();
  const clientLines = [q.clientMobile, q.clientEmail, q.clientGstin ? `GSTIN: ${q.clientGstin}` : null].filter(Boolean) as string[];

  // Build flat list with room headers interleaved
  const tableItems: ({ type: "room"; label: string } | { type: "line"; line: typeof q.lines[0]; idx: number })[] = [];
  let lineIdx = 0; let lastRoom: string | null | undefined;
  for (const line of q.lines) {
    if (line.roomLabel && line.roomLabel !== lastRoom) { tableItems.push({ type: "room", label: line.roomLabel }); lastRoom = line.roomLabel; }
    tableItems.push({ type: "line", line, idx: lineIdx++ });
  }

  const advance = q.total / 2n;
  const balance = q.total - advance;

  return (
    <Document title={`${docLabel} ${q.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        <View style={s.stripe} />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            {logoSrc
              ? <Image src={logoSrc} style={s.logoImg} />
              : <Text style={{ fontSize: 20, fontWeight: "bold", color: BRAND }}>Mandovara</Text>
            }
            <Text style={s.logoTagline}>INTERIORS · COIMBATORE</Text>
          </View>
          <View style={s.headerMeta}>
            <Text style={s.docBadge}>{docLabel}</Text>
            <Text style={s.docNumber}>{q.number}</Text>
            {q.revision > 0 && <View style={s.docMetaRow}><Text style={s.docMetaLbl}>REVISION</Text><Text style={s.docMetaVal}>{q.revision}</Text></View>}
            <View style={s.docMetaRow}><Text style={s.docMetaLbl}>DATE</Text><Text style={s.docMetaVal}>{fd(q.date)}</Text></View>
            <View style={s.docMetaRow}><Text style={s.docMetaLbl}>VALID UNTIL</Text><Text style={s.docMetaVal}>{fd(q.validUntil)}</Text></View>
            <View style={s.docMetaRow}><Text style={s.docMetaLbl}>BRANCH</Text><Text style={s.docMetaVal}>{q.branchName}</Text></View>
          </View>
        </View>

        {/* ── Party boxes ──────────────────────────────────────────── */}
        <View style={s.partyRow}>
          <View style={s.partyBox}>
            <Text style={s.partyLabel}>QUOTATION BY</Text>
            <Text style={s.partyName}>{FROM.name}</Text>
            <Text style={s.partyLine}>{FROM.addr1}</Text>
            <Text style={s.partyLine}>{FROM.addr2}</Text>
            <Text style={s.partyLine}>{FROM.state}</Text>
            <Text style={s.partyLine}>{FROM.phone}</Text>
            <Text style={s.partyAccent}>{FROM.email}</Text>
            {q.ownerName && <Text style={[s.partyLine, { marginTop: 6, color: BRAND }]}>Designer: {q.ownerName}</Text>}
          </View>
          <View style={s.partyBox}>
            <Text style={s.partyLabel}>QUOTATION TO</Text>
            <Text style={s.partyName}>{q.clientName}</Text>
            {clientLines.map((l) => <Text key={l} style={s.partyLine}>{l}</Text>)}
            {q.projectName && <Text style={s.partyAccent}>Project: {q.projectName}</Text>}
          </View>
        </View>

        {/* ── Supply band ──────────────────────────────────────────── */}
        <View style={s.supplyBand}>
          <View style={s.supplyItem}><Text style={s.supplyLbl}>PLACE OF SUPPLY:</Text><Text style={s.supplyVal}>{stateLabel}</Text></View>
          <View style={s.supplyItem}><Text style={s.supplyLbl}>TAX TYPE:</Text><Text style={s.supplyVal}>{isIntra ? "CGST + SGST" : "IGST"}</Text></View>
          <View style={s.supplyItem}><Text style={s.supplyLbl}>COUNTRY:</Text><Text style={s.supplyVal}>India</Text></View>
        </View>

        {/* ── Items table ──────────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <TH fixed />
          {tableItems.map((item, i) =>
            item.type === "room"
              ? <RoomHeader key={`room-${i}`} label={item.label} />
              : <TR key={item.line.id} line={item.line} idx={item.idx} />
          )}
        </View>

        <View style={s.divider} />

        {/* ── Terms (left) | Totals (right) ────────────────────────── */}
        <View style={s.bottomRow} wrap={false}>
          <View style={s.termsCol}>
            <Text style={s.termsSec}>TERMS &amp; CONDITIONS</Text>
            {terms.map((t, i) => <Text key={i} style={s.termsBullet}>{i + 1}.{"  "}{t}</Text>)}
          </View>

          <View style={s.totalsCol}>
            <View style={s.totRow}><Text style={s.totLbl}>Sub Total (excl. GST)</Text><Text style={s.totVal}>{fm(q.taxableAmount)}</Text></View>
            {isIntra ? (
              <>
                <View style={s.totRow}><Text style={s.totLbl}>CGST {half}</Text><Text style={s.totVal}>{fm(q.cgst)}</Text></View>
                <View style={s.totRow}><Text style={s.totLbl}>SGST {half}</Text><Text style={s.totVal}>{fm(q.sgst)}</Text></View>
              </>
            ) : (
              <View style={s.totRow}><Text style={s.totLbl}>IGST</Text><Text style={s.totVal}>{fm(q.igst)}</Text></View>
            )}
            {q.roundOff !== 0n && <View style={s.totRow}><Text style={s.totLbl}>Round-off</Text><Text style={s.totVal}>{fm(q.roundOff)}</Text></View>}

            <View style={s.paySection}>
              <Text style={s.paySec}>PAYMENT SCHEDULE</Text>
              <View style={s.payRow}><Text style={s.payLbl}>Advance (50%) to confirm</Text><Text style={s.payVal}>{fm(advance)}</Text></View>
              <View style={s.payRow}><Text style={s.payLbl}>Balance on installation</Text><Text style={s.payVal}>{fm(balance)}</Text></View>
            </View>

            <View style={s.grandBox}>
              <View style={s.grandRow}>
                <Text style={s.grandLbl}>GRAND TOTAL</Text>
                <Text style={s.grandAmt}>{fm(q.total)}</Text>
              </View>
              <Text style={s.wordsText}>{rupeesToWords(q.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerBrand}>mandovara.com</Text>
            <Text style={s.footerText}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</Text>
            <Text style={s.footerText}>{`${FROM.phone} · ${FROM.email} · Ref: ${q.number}`}</Text>
            <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
          </View>
        </View>

      </Page>
    </Document>
  );
}
