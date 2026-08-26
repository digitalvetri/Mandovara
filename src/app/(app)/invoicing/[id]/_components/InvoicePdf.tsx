// Server-rendered invoice PDF.
//
// Owner redesign (2026-08-26): the invoice is now the customer-facing
// document in the invoice-first flow, so it uses the same visual
// language as the sample estimates (branded header banner, yellow
// customer/location bars, tight 5-col ITEM table, red TOTAL, prose
// T&C + refund policy). GST-line breakdown, party boxes, and legal
// tax-invoice header are dropped — the customer sees the same clean
// estimate the owner used to hand-write. GST is still stored on the
// invoice for internal reports/reconciliation; it just isn't printed.
//
// Fonts + shared table components live under the quotations folder;
// we import from there to avoid duplicating the template. A future
// refactor could move them to src/lib/pdf/ if a third document ever
// needs the same look.

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { InvoiceDetail, InvoiceLineRow } from "@/modules/invoices/queries";
import { pdfStyles as s } from "@/app/(app)/quotations/[id]/_components/_pdf-styles";
import { TH, fm } from "@/app/(app)/quotations/[id]/_components/_pdf-table";

const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold"  },
  ],
});

const UNIT_SHORT: Record<string, string> = {
  METRE: "MTR", ROLL: "ROLLS", SQFT: "SQFT", SQM: "SQM",
  PIECE: "NOS", SET: "SET", BOX: "BOX", RUNNING_FT: "RFT",
};

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

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

// Invoice line-level AMT — sample-style rate × qty. Discounts are not
// currently stored on invoice lines (only on quotations), so no
// separate discount row is needed here.
function invoiceLineGross(line: InvoiceLineRow): bigint {
  const qtyNum = parseFloat(line.quantity);
  return (line.rate * BigInt(Math.round(qtyNum * 10_000))) / 10_000n;
}

function InvoiceTR({ line }: { line: InvoiceLineRow }) {
  const qtyNum = parseFloat(line.quantity);
  return (
    <View style={s.tr} wrap={false}>
      <View style={s.cItem}>
        <Text style={s.td}>{line.description || "—"}</Text>
      </View>
      <View style={s.cUnit}>
        <Text style={[s.td, s.tdCenter]}>{UNIT_SHORT[line.unit] ?? line.unit}</Text>
      </View>
      <View style={s.cQty}>
        <Text style={[s.td, s.tdCenter]}>{Number.isInteger(qtyNum) ? qtyNum : line.quantity}</Text>
      </View>
      <View style={s.cRate}>
        <Text style={[s.td, s.tdCenter]}>{fm(line.rate)}</Text>
      </View>
      <View style={s.cAmt}>
        <Text style={[s.td, s.tdRight]}>{fm(invoiceLineGross(line))}</Text>
      </View>
    </View>
  );
}

export function InvoicePdf({ invoice: i, logoSrc }: { invoice: InvoiceDetail; logoSrc?: string }) {
  const customerLine = i.clientMobile
    ? `${i.clientName.toUpperCase()} - ${i.clientMobile}`
    : i.clientName.toUpperCase();
  const location = ""; // InvoiceDetail doesn't currently carry projectName; leave blank.

  // Sample-style total = sum of rate × qty. Ignores GST for display
  // (still stored in the DB via i.total for reports/e-invoicing).
  const totalPreTax = i.lines.reduce((sum, l) => sum + invoiceLineGross(l), 0n);

  return (
    <Document title={`Invoice ${i.number}`} author="Mandovara" creator="Mandovara Interior OS">
      <Page size="A4" style={s.page}>

        {/* ── Branded header banner ────────────────────────────── */}
        <View style={s.banner}>
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

        {/* ── Doc meta (small paper-trail strip) ───────────────── */}
        <View style={s.metaStrip}>
          <Text style={s.metaLbl}>REF</Text>
          <Text style={s.metaVal}>{i.number}</Text>
          <Text style={s.metaLbl}>DATE</Text>
          <Text style={s.metaVal}>{fmtDate(i.date)}</Text>
        </View>

        {/* ── Yellow customer bar ──────────────────────────────── */}
        <View style={[s.yellowBar, s.yellowBarBorderT, s.yellowBarBorderB]}>
          <Text style={s.yellowBarCustomer}>{customerLine}</Text>
        </View>

        {/* ── Yellow location bar (skipped if empty) ───────────── */}
        {location.length > 0 && (
          <View style={[s.yellowBar, s.yellowBarBorderB]}>
            <Text style={s.yellowBarLocation}>{location.toUpperCase()}</Text>
          </View>
        )}

        {/* ── Items table ──────────────────────────────────────── */}
        <View style={s.tableWrap}>
          <TH fixed />
          {i.lines.map((l) => <InvoiceTR key={l.id} line={l} />)}
          <View style={s.trTotal} wrap={false}>
            <View style={s.cItem}><Text style={s.tdTotal}>TOTAL</Text></View>
            <View style={s.cUnit} />
            <View style={s.cQty} />
            <View style={s.cRate} />
            <View style={s.cAmt}><Text style={[s.tdTotal, s.tdRight]}>{fm(totalPreTax)}</Text></View>
          </View>
        </View>

        {/* ── Terms + Refund policy ────────────────────────────── */}
        <View style={s.policyWrap}>
          {TERMS.map((t, idx) => (
            <Text key={idx} style={t.red ? s.policyLineRed : s.policyLine}>
              {t.text}
            </Text>
          ))}
          <Text style={s.policyHeading}>ORDER CANCELLATION and REFUND POLICY</Text>
          {REFUND.map((line, idx) => (
            <Text key={idx} style={s.policyLine}>{line}</Text>
          ))}
        </View>

      </Page>
    </Document>
  );
}
