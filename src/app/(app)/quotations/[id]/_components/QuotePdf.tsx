// The quotation Mandovara sends clients.
//
// Rewritten 2026-08-28 against two live documents the owner supplied as
// the specification (VINITHA MAM.pdf, SENTHIL SIR NEELAMBUR.pdf). The
// app had been producing a GST tax-quotation — party boxes, place of
// supply, HSN codes, a CGST/SGST breakdown — while the studio's actual
// quotations are a letterhead, two yellow bands naming the client and
// the area, one bordered ITEM/Unit/QTY/RATE/AMT table, and the standing
// terms. Clients recognise the second document; this now produces it.
//
// TAX: 2026-09-11 — GST is back on the page. The AMT column still lists
// each line at its gross, undiscounted rate (unchanged from the redesign
// above), but the figure a client actually owes is `total`
// (taxableAmount + cgst/sgst/igst + roundOff), so the block under the
// table now shows Taxable Amount, CGST+SGST (or IGST for an inter-state
// client) and Round-off before the highlighted TOTAL — the same shape
// InvoicePdf.tsx uses. Quotation carries no placeOfSupplyCode column, so
// intra vs. inter-state is read the same way the in-app header does it
// (QuotationHeader.tsx): `igst === 0n` means intra-state.
// QuotePreviewA4.tsx mirrors this exactly — change one, change the other.
//
// DISCOUNT: the source prints lines at full rate and then one red
// "LESS DIS. 25%" row. So do we — each line shows qty × rate, and the
// discount their per-line percentages add up to is collected into a
// single row underneath. No schema change: this is the existing
// discountPct, presented the way the studio presents it.

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { QuotationDetail } from "@/modules/quotations/queries";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import { pdfStyles as s } from "./_pdf-styles";
import { TableHead, ItemRow, GroupRow, DeductionRow, amt } from "./_pdf-table";
import { grossOf, layout } from "./_pdf-layout";
import {
  MANDOVARA_TERMS, EMPHASISED_TERM, CANCELLATION_HEADING,
  CANCELLATION_TERMS, CLOSING_LINES,
} from "./_quote-terms";
import {
  ContactLine, MetaCard, SectionHeading, Clause,
  PhoneIcon, MailIcon, PinIcon, DocIcon, CalendarIcon, ClockIcon,
  InfoIcon, ShieldIcon, NoteIcon,
} from "./_pdf-chrome";

/** Studio details, printed rather than pasted in as a photograph. */
const FROM = {
  phone: "+91 089404 30051",
  email: "mandovara22@gmail.com",
  addr:  "32, Thirumurthy Layout, Thadagam Road,\nR S Puram, Coimbatore - 641 002",
};

function fd(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  });
}

// ── fonts ──────────────────────────────────────────────────────────────────
const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold"  },
  ],
});

interface Props { quotation: QuotationDetail; logoSrc?: string }

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const estimate = isEstimate(q.lines);
  const blocks   = layout(q.lines);

  // See the tax note at the top: TOTAL is GST-inclusive, with the split
  // shown above it.
  const isIntra = q.igst === 0n;
  const taxRows: Array<{ label: string; value: bigint }> = [
    { label: "Taxable Amount", value: q.taxableAmount },
    ...(isIntra
      ? [{ label: "CGST", value: q.cgst }, { label: "SGST", value: q.sgst }]
      : [{ label: "IGST", value: q.igst }]),
    ...(q.roundOff !== 0n ? [{ label: "Round-off", value: q.roundOff }] : []),
  ];

  // A quotation's own terms still win when someone has written them.
  const customTerms = q.termsText
    ? q.termsText.split("\n").map((t) => t.trim()).filter(Boolean)
    : null;

  const area = q.siteArea ?? q.projectName ?? "";

  return (
    <Document
      title={`${estimate ? "Estimate" : "Quotation"} ${q.number}`}
      author="Mandovara"
      creator="Mandovara"
    >
      <Page size="A4" style={s.page}>

        <View style={s.edgeLeft} fixed />
        <View style={s.edgeBottom} fixed />

        {/* ── Identity ─────────────────────────────────────────────── */}
        <View style={s.identityRow}>
          <View style={s.identityLeft}>
            {logoSrc && <Image src={logoSrc} style={s.mark} />}
            <Text style={s.wordmark}>Mandovara</Text>
            <Text style={s.tagline}>PREMIUM WALL COVERINGS</Text>

            <ContactLine icon={<PhoneIcon />}>{FROM.phone}</ContactLine>
            <ContactLine icon={<MailIcon />}>{FROM.email}</ContactLine>
            <ContactLine icon={<PinIcon />}>{FROM.addr}</ContactLine>
          </View>

          <View style={s.identityRight}>
            <Text style={s.docTitle}>{estimate ? "ESTIMATE" : "QUOTATION"}</Text>
            <View style={s.docRule} />

            <MetaCard icon={<DocIcon />}      label="QUOTE NO."   value={q.number} />
            <MetaCard icon={<CalendarIcon />} label="DATE"        value={fd(q.date)} />
            <MetaCard icon={<ClockIcon />}    label="VALID UNTIL" value={fd(q.validUntil)} />
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Who and where ────────────────────────────────────────── */}
        <View style={s.headRow}>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>QUOTATION FOR</Text>
            <Text style={s.partyName}>{q.clientName}</Text>
            <View style={s.partyMetaRow}>
              <PhoneIcon size={8} />
              <Text style={[s.partyMeta, { marginLeft: 5 }]}>{q.clientMobile}</Text>
              {!!area && (
                <>
                  <View style={s.partySep} />
                  <PinIcon size={8} />
                  <Text style={[s.partyMeta, { marginLeft: 5 }]}>{area}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Items ────────────────────────────────────────────────── */}
        <View style={s.table}>
          <TableHead />

          {(() => {
            // Zebra counts only priced rows, so a caption or a discount
            // line does not break the alternation of the items around it.
            let n = 0;
            return blocks.map((b, i) => {
              if (b.kind === "group")    return <GroupRow key={`g-${i}`} label={b.label} />;
              if (b.kind === "discount") return <DeductionRow key={`d-${i}`} label={b.label} value={b.value} />;
              const alt = n++ % 2 === 1;
              return (
                <ItemRow
                  key={b.line.id}
                  item={b.line.description}
                  unit={b.line.unit}
                  quantity={b.line.quantity}
                  rate={b.line.rate}
                  amount={grossOf(b.line)}
                  alt={alt}
                />
              );
            });
          })()}
        </View>

        {/* The figure a client looks for first, given its own block
            rather than being one more cell in a grid. */}
        <View style={s.totalWrap}>
          <View style={s.taxRowsWrap}>
            {taxRows.map(({ label, value }) => (
              <View key={label} style={s.taxRow}>
                <Text style={s.taxLabel}>{label}</Text>
                <Text style={s.taxValue}>{amt(value)}</Text>
              </View>
            ))}
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>TOTAL</Text>
            <Text style={s.totalValue}>{amt(q.total)}</Text>
          </View>
        </View>

        {/* An estimate must keep saying it is one — it is priced
            before anyone has measured. */}
        {estimate && (
          <View style={s.notice}>
            <View style={s.noticeIcon}><InfoIcon /></View>
            <Text style={s.noticeText}>{ESTIMATE_CAVEAT}</Text>
          </View>
        )}

        {/* ── Terms, side by side ──────────────────────────────────── */}
        {/* Two columns rather than one long list: the same clauses read
            in half the height, which is what keeps this on one page. */}
        <View style={s.termsCols}>
          <View style={s.termsCol}>
            <SectionHeading icon={<NoteIcon />} title="TERMS & CONDITIONS" />
            {(customTerms ?? MANDOVARA_TERMS).map((t, i) => (
              <Clause key={i} n={i + 1} strong={!customTerms && i === EMPHASISED_TERM}>
                {t}
              </Clause>
            ))}
          </View>

          <View style={s.termsCol}>
            {!customTerms && (
              <>
                <SectionHeading icon={<ShieldIcon />} title={CANCELLATION_HEADING.toUpperCase()} />
                {CANCELLATION_TERMS.map((t, i) => (
                  <Clause key={i} n={i + 1}>{t}</Clause>
                ))}
              </>
            )}
          </View>
        </View>

        {!customTerms && (
          <View style={s.closingBox}>
            <View style={s.closingBadge}><DocIcon size={12} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              {CLOSING_LINES.map((t, i) => (
                <Text key={i} style={s.closingText}>{t}</Text>
              ))}
            </View>
          </View>
        )}

      </Page>
    </Document>
  );
}
