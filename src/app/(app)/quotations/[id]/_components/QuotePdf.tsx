// Server-side quotation PDF — @react-pdf/renderer.
//
// Owner redesign (2026-08-26): matches the hand-crafted sample PDFs
// the owner used to send before this system. Branded header banner,
// yellow customer/location bars, tight 5-col ITEM table, red TOTAL,
// two verbatim policy blocks. No GST breakdown, no party boxes, no
// payment schedule — the customer sees an interior-decor estimate,
// not a compliance document.
//
// Fonts: GeistRegular (normal) + NotoSans-Bold (bold, has ₹).

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { QuotationDetail } from "@/modules/quotations/queries";
import { pdfStyles as s } from "./_pdf-styles";
import { TH, TR, SectionRow, DiscountRow, TotalRow } from "./_pdf-table";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold"  },
  ],
});

// Hardcoded terms + policy — verbatim from the owner's sample PDFs.
// If the owner customises terms via the quotation.termsText field, that
// overrides this fallback (falls back per-line, split on newline).
const TERMS: { text: string; red?: boolean }[] = [
  { text: "1. Consumption will be as per the standard packages available either in the form of rolls or meters" },
  { text: "2. Full Advance Payment to be paid as per mentioned order value.", red: true },
  { text: "3. For all paid payments, customer to get customer voucher, estimate form, challan with the customer's signature." },
  { text: "4. Incase of any discrepencies, please SMS on 08940450051." },
  { text: "5. Any form of concession/discount/scheme is applicable on the products only." },
  { text: "6. The discount schemes if any is NOT APPLICABLE on surface preparation / labour services / consumables / transport / misc etc." },
  { text: "7. If the catalogues are stocked by the customer, it is subject to a MOV @ Rs. 6500 per Catalogue & Admin Charges @ Rs. 1500 is applicable." },
];

const REFUND: string[] = [
  "1. Order once placed cannot be cancelled. Advance once paid will not be refunded.",
  "2. Refund of advance is granted post deducting the admin charges of Rs 1500/- with an option to choose any other product offered by the company.",
  "3. Refund against excess goods will be done only if it in a packed roll/box/package and saleable condition. Refund will be processed via cheque within 15 days of order completion.",
  "4. For IR (Import Requisition) orders of non-stock goods, once placed will not be cancelled.",
  "5. Incase of any issues at the customs or force majeure, the refund will be processed.",
  "Orders once confirmed & advance paid is not subject to cancellation or aborted for whatever reason. Alternately the customer is given an option to choose any other products offered by company.",
];

function fd(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

interface Props {
  quotation: QuotationDetail;
  logoSrc?: string;
}

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const customerLine = q.clientMobile
    ? `${q.clientName.toUpperCase()} - ${q.clientMobile}`
    : q.clientName.toUpperCase();
  const location = (q.projectName ?? "").trim();
  const customTerms = q.termsText ? q.termsText.split("\n").map((t) => t.trim()).filter(Boolean) : null;

  // Group lines by roomLabel — when it changes, insert a SectionRow.
  // Lines without a roomLabel render as loose products (matches the
  // sample's LINING CLOTH / TRACK / STITCHING sequence, none of which
  // sat under a section header).
  const rowsEls: React.ReactNode[] = [];
  let lastSection: string | null = null;
  for (const l of q.lines) {
    const section = (l.roomLabel ?? "").trim();
    if (section && section !== lastSection) {
      rowsEls.push(<SectionRow key={`sec-${l.id}`} label={section} />);
      lastSection = section;
    } else if (!section) {
      lastSection = null;
    }
    rowsEls.push(<TR key={l.id} line={l} />);
    if (parseFloat(l.discountPct) > 0) {
      rowsEls.push(<DiscountRow key={`disc-${l.id}`} line={l} />);
    }
  }

  return (
    <Document title={`Quotation ${q.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        {/* ── Branded header banner ────────────────────────────── */}
        <View style={s.banner} fixed>
          <View style={s.bannerLogoWrap}>
            {logoSrc && <Image src={logoSrc} style={s.bannerLogoImg} />}
          </View>
          <View style={s.bannerRight}>
            <View style={s.bannerNameRow}>
              <Text style={s.bannerName}>Rohit Vaid</Text>
              <Text style={s.bannerRole}>MANAGING DIRECTOR</Text>
            </View>
            <View style={s.bannerContact}>
              <View style={s.bannerContactRow}>
                <Text style={s.bannerContactIco}>Tel</Text>
                <Text style={s.bannerContactTxt}>+91 89404 30051</Text>
              </View>
              <View style={s.bannerContactRow}>
                <Text style={s.bannerContactIco}>Email</Text>
                <Text style={s.bannerContactTxt}>mandovara22@gmail.com</Text>
              </View>
            </View>
            <Text style={s.bannerAddr}>
              32, Thirumurthy Layout, Thadagam Road, R S Puram, Coimbatore - 641 002
            </Text>
          </View>
        </View>

        {/* ── Doc meta (small, only shown to keep the paper trail) ── */}
        <View style={s.metaStrip}>
          <Text style={s.metaLbl}>REF</Text>
          <Text style={s.metaVal}>{q.number}</Text>
          <Text style={s.metaLbl}>DATE</Text>
          <Text style={s.metaVal}>{fd(q.date)}</Text>
        </View>

        {/* ── Yellow customer bar ──────────────────────────────── */}
        <View style={[s.yellowBar, s.yellowBarBorderT, s.yellowBarBorderB]}>
          <Text style={s.yellowBarCustomer}>{customerLine}</Text>
        </View>

        {/* ── Yellow location bar (project name if present) ────── */}
        {location.length > 0 && (
          <View style={[s.yellowBar, s.yellowBarBorderB]}>
            <Text style={s.yellowBarLocation}>{location.toUpperCase()}</Text>
          </View>
        )}

        {/* ── Items table ──────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <TH fixed />
          {rowsEls}
          <TotalRow total={q.taxableAmount} />
        </View>

        {/* ── Terms + Refund policy ────────────────────────────── */}
        <View style={s.policyWrap}>
          {(customTerms ?? TERMS.map((t) => t.text)).map((line, i) => {
            // Preserve red styling on the "Full Advance Payment" line
            // from the sample when the default set is in use.
            const isRed = !customTerms && TERMS[i]?.red === true;
            return (
              <Text key={i} style={isRed ? s.policyLineRed : s.policyLine}>
                {line}
              </Text>
            );
          })}

          <Text style={s.policyHeading}>ORDER CANCELLATION and REFUND POLICY</Text>
          {REFUND.map((line, i) => (
            <Text key={i} style={s.policyLine}>{line}</Text>
          ))}
        </View>

      </Page>
    </Document>
  );
}
