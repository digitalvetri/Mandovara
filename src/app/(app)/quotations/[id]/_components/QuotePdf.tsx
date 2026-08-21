// Server-side quotation PDF — @react-pdf/renderer.
// Fonts: GeistRegular (normal, has ₹ U+20B9) + NotoSans-Bold (bold, has ₹).

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { QuotationDetail, QuotationLine } from "@/modules/quotations/queries";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import { rupeesToWords } from "./_words";
import { pdfStyles as s, WHITE, INK, MUTED, STRIP, BRAND } from "./_pdf-styles";

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
const U: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

function fd(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

function fm(p: bigint): string {
  const neg = p < 0n;
  const a   = neg ? -p : p;
  const r   = a / 100n;
  const raw = r.toString();
  const grp = raw.length <= 3 ? raw
    : raw.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + raw.slice(-3);
  return neg ? `(${grp})` : grp;
}

function fmr(p: bigint): string { return `₹${fm(p)}`; }

function gstRateLabel(cgst: bigint, taxable: bigint): string {
  if (taxable === 0n) return "";
  const rate = Math.round(Number(cgst * 10000n / taxable)) / 100;
  return `(${Number.isInteger(rate) ? rate : rate.toFixed(1)}%)`;
}

// ── constants ──────────────────────────────────────────────────────────────
const FROM = {
  name:  "Mandovara",
  addr1: "32 Thirumoorthy Layout, Thadagam Road",
  addr2: "RS Puram, Coimbatore 641002",
  state: "Tamil Nadu (33), India",
  phone: "+91 89404 30051",
  email: "mandovara22@gmail.com",
};

const ESTIMATE_TERMS = [
  ESTIMATE_CAVEAT,
  "This estimate is indicative — a firm quotation follows site measurement.",
  "Estimate is valid until the date mentioned above.",
];

const DEFAULT_TERMS = [
  "Quotation is valid until the date mentioned above.",
  "50% advance required to confirm the order.",
  "Balance payable before or on delivery / installation.",
  "Goods once delivered cannot be returned.",
  "Installation timeline is as per the agreed schedule.",
];

// ── sub-components ─────────────────────────────────────────────────────────
function TH({ fixed: fx }: { fixed?: boolean }) {
  return (
    <View style={s.thead} fixed={fx}>
      <View style={s.cNo}  ><Text style={[s.th, { textAlign: "center"  }]}>#</Text></View>
      <View style={s.cDesc}><Text style={s.th}>DESCRIPTION / ROOM</Text></View>
      <View style={s.cQty} ><Text style={[s.th, { textAlign: "right"   }]}>QTY</Text></View>
      <View style={s.cUnit}><Text style={s.th}>UNIT</Text></View>
      <View style={s.cRate}><Text style={[s.th, { textAlign: "right"   }]}>RATE (₹)</Text></View>
      <View style={s.cGst} ><Text style={[s.th, { textAlign: "right"   }]}>GST</Text></View>
      <View style={s.cAmt} ><Text style={[s.th, { textAlign: "right"   }]}>AMOUNT (₹)</Text></View>
    </View>
  );
}

function TR({ line: l, idx }: { line: QuotationLine; idx: number }) {
  return (
    <View style={[s.tr, { backgroundColor: idx % 2 === 1 ? STRIP : WHITE }]} wrap={false}>
      <View style={s.cNo}  ><Text style={[s.tdMain, { textAlign: "center", color: MUTED }]}>{idx + 1}</Text></View>
      <View style={s.cDesc}>
        <Text style={s.tdMain}>{l.description || "—"}</Text>
        {l.roomLabel   ? <Text style={s.tdSub}>{l.roomLabel}</Text>  : null}
        {l.isOptional  ? <Text style={s.tdOpt}>Optional</Text>       : null}
      </View>
      <View style={s.cQty} ><Text style={[s.tdRight, { color: INK   }]}>{parseFloat(l.quantity)}</Text></View>
      <View style={s.cUnit}><Text style={[s.tdMain,  { color: MUTED }]}>{U[l.unit] ?? l.unit.toLowerCase()}</Text></View>
      <View style={s.cRate}><Text style={[s.tdRight, { fontWeight: "bold" }]}>{fmr(l.rate)}</Text></View>
      <View style={s.cGst} ><Text style={[s.tdRight, { color: MUTED }]}>{l.gstRate}%</Text></View>
      <View style={s.cAmt} ><Text style={[s.tdRight, { fontWeight: "bold", color: BRAND }]}>{fmr(l.amount)}</Text></View>
    </View>
  );
}

// ── main component ─────────────────────────────────────────────────────────
interface Props { quotation: QuotationDetail; logoSrc?: string }

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const estimate  = isEstimate(q.lines);
  const isIntra   = q.cgst > 0n;
  const rateLabel = isIntra ? gstRateLabel(q.cgst, q.taxableAmount) : "";
  const docTitle  = estimate ? "ESTIMATE" : "QUOTATION";
  const stateLabel = q.supplierStateCode === "33" ? "Tamil Nadu (33)" : q.supplierStateCode;

  const taxRows: { label: string; v: bigint }[] = [
    { label: "Taxable Amount",           v: q.taxableAmount },
    ...(isIntra
      ? [{ label: `CGST ${rateLabel}`, v: q.cgst },
         { label: `SGST ${rateLabel}`, v: q.sgst }]
      : [{ label: "IGST",               v: q.igst }]),
    ...(q.roundOff !== 0n ? [{ label: "Round-off", v: q.roundOff }] : []),
  ];

  const baseTerms = q.termsText
    ? q.termsText.split("\n").filter(Boolean)
    : (estimate ? ESTIMATE_TERMS : DEFAULT_TERMS);
  const terms = estimate && !baseTerms.includes(ESTIMATE_CAVEAT)
    ? [ESTIMATE_CAVEAT, ...baseTerms]
    : baseTerms;

  const clientLines = [
    q.clientMobile,
    q.clientEmail,
    q.clientGstin ? `GSTIN: ${q.clientGstin}` : null,
  ].filter(Boolean) as string[];

  return (
    <Document title={`${docTitle} ${q.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        {/* ── Top accent stripe ────────────────────────────────────── */}
        <View style={s.stripe} />

        {/* ── Header: logo left · title right ─────────────────────── */}
        <View style={s.headerWrap}>
          {logoSrc
            ? <Image src={logoSrc} style={s.logoImg} />
            : (
              <View style={s.headerLeft}>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: BRAND }}>Mandovara</Text>
                <Text style={{ fontSize: 6.5, color: MUTED, letterSpacing: 1.5, marginTop: 2 }}>
                  INTERIORS · COIMBATORE
                </Text>
              </View>
            )
          }
          <View style={s.headerRight}>
            <Text style={s.docTitle}>{docTitle}</Text>
            {q.revision > 0 && (
              <Text style={[s.docMeta, { color: BRAND }]}>Revision {q.revision}</Text>
            )}
            <Text style={s.docMeta}>No.{" "}
              <Text style={s.docNum}>{q.number}</Text>
            </Text>
          </View>
        </View>

        {/* ── Meta strip: date, valid, branch ──────────────────────── */}
        <View style={s.metaStrip}>
          {[
            { label: "DATE",        value: fd(q.date)       },
            { label: "VALID UNTIL", value: fd(q.validUntil) },
            { label: "BRANCH",      value: q.branchName     },
          ].map(({ label, value }) => (
            <View key={label}>
              <Text style={s.metaLbl}>{label}</Text>
              <Text style={s.metaVal}>{value}</Text>
            </View>
          ))}
        </View>

        {/* ── Party boxes: Quotation By | Quotation To ─────────────── */}
        <View style={s.partyRow}>
          {/* FROM */}
          <View style={s.partyBox}>
            <Text style={s.partyTitle}>Quotation By</Text>
            <Text style={s.partyName}>{FROM.name}</Text>
            <Text style={s.partyLine}>{FROM.addr1}</Text>
            <Text style={s.partyLine}>{FROM.addr2}</Text>
            <Text style={s.partyLine}>{FROM.state}</Text>
            <Text style={s.partyLine}>{FROM.phone}</Text>
            <Text style={s.partyAccent}>{FROM.email}</Text>
          </View>

          {/* TO */}
          <View style={s.partyBox}>
            <Text style={s.partyTitle}>Quotation To</Text>
            <Text style={s.partyName}>{q.clientName}</Text>
            {clientLines.map((l) => (
              <Text key={l} style={s.partyLine}>{l}</Text>
            ))}
            {q.projectName && (
              <Text style={s.partyAccent}>Project: {q.projectName}</Text>
            )}
          </View>
        </View>

        {/* ── Supply band ──────────────────────────────────────────── */}
        <View style={s.supplyBand}>
          <View style={s.supplyItem}>
            <Text style={s.supplyLbl}>PLACE OF SUPPLY:</Text>
            <Text style={s.supplyVal}>{stateLabel}</Text>
          </View>
          <View style={s.supplyItem}>
            <Text style={s.supplyLbl}>TAX TYPE:</Text>
            <Text style={s.supplyVal}>{isIntra ? "CGST + SGST" : "IGST"}</Text>
          </View>
          <View style={s.supplyItem}>
            <Text style={s.supplyLbl}>COUNTRY OF SUPPLY:</Text>
            <Text style={s.supplyVal}>India</Text>
          </View>
        </View>

        {/* ── Items table ──────────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <TH fixed />
          {q.lines.map((l, i) => <TR key={l.id} line={l} idx={i} />)}
        </View>

        {/* ── Terms | Totals ───────────────────────────────────────── */}
        <View style={s.bottomRow} wrap={false}>
          <View style={s.termsCol}>
            <Text style={s.termsSec}>TERMS &amp; CONDITIONS</Text>
            {terms.map((t, i) => (
              <Text key={i} style={s.termsBullet}>{i + 1}.{"  "}{t}</Text>
            ))}
          </View>
          <View style={s.totalsCol}>
            {taxRows.map(({ label, v }) => (
              <View key={label} style={s.totRow}>
                <Text style={s.totLbl}>{label}</Text>
                <Text style={s.totVal}>{fmr(v)}</Text>
              </View>
            ))}
            <View style={s.grandRow}>
              <Text style={s.grandLbl}>GRAND TOTAL</Text>
              <Text style={s.grandVal}>{fmr(q.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Amount in words ──────────────────────────────────────── */}
        <View style={s.wordsWrap} wrap={false}>
          <Text style={s.wordsLbl}>AMOUNT IN WORDS</Text>
          <Text style={s.wordsText}>{rupeesToWords(q.total)}</Text>
        </View>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerBrand}>mandovara.com</Text>
            <Text style={s.footerText}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</Text>
            <Text style={s.footerText}>+91 89404 30051 · mandovara22@gmail.com</Text>
            <Text style={s.footerText}
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
            />
          </View>
        </View>

      </Page>
    </Document>
  );
}
