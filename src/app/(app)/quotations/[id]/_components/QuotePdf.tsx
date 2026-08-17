// Server-side quotation PDF — @react-pdf/renderer.
// Fonts: GeistRegular (normal, has ₹ U+20B9) + NotoSans-Bold (bold, has ₹).

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { QuotationDetail, QuotationLine } from "@/modules/quotations/queries";
import { rupeesToWords } from "./_words";
import { pdfStyles as s, WHITE, INK, MUTED, STRIP } from "./_pdf-styles";

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
            <Text style={s.wordsText}>{rupeesToWords(q.total)}</Text>
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
