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
// TAX: nothing on this page mentions GST, per the owner's decision. That
// makes the arithmetic printable — TOTAL is the sum of the AMT column
// and a reader can check it by adding the rows up. Concretely it prints
// `taxableAmount` (Σ line.taxable), NOT `total`, because `total =
// taxableAmount + cgst + sgst + igst + roundOff`; printing `total` under
// a table with no tax row would be off by the GST with nothing on the
// page to explain the difference. GST is still computed and stored on
// the record, and still appears on the invoice.
//
// DISCOUNT: the source prints lines at full rate and then one red
// "LESS DIS. 25%" row. So do we — each line shows qty × rate, and the
// discount their per-line percentages add up to is collected into a
// single row underneath. No schema change: this is the existing
// discountPct, presented the way the studio presents it.

import path from "path";
import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer";
import type { QuotationDetail, QuotationLine } from "@/modules/quotations/queries";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import { pdfStyles as s } from "./_pdf-styles";
import { TableHead, ItemRow, GroupRow, DeductionRow, amt } from "./_pdf-table";
import {
  MANDOVARA_TERMS, EMPHASISED_TERM, CANCELLATION_HEADING,
  CANCELLATION_TERMS, CLOSING_LINES,
} from "./_quote-terms";

// ── fonts ──────────────────────────────────────────────────────────────────
const FONTS = path.join(process.cwd(), "public", "fonts");
Font.register({
  family: "Geist",
  fonts: [
    { src: path.join(FONTS, "GeistRegular.ttf"), fontWeight: "normal" },
    { src: path.join(FONTS, "NotoSans-Bold.ttf"), fontWeight: "bold"  },
  ],
});

/** Undiscounted line value — what the source prints in the AMT column. */
function grossOf(l: QuotationLine): bigint {
  const q = Number(l.quantity);
  if (!Number.isFinite(q)) return l.taxable;
  return BigInt(Math.round(Number(l.rate) * q));
}

/** Discount taken off one line, in paise. Zero when there is none. */
function cutOf(l: QuotationLine): bigint {
  const cut = grossOf(l) - l.taxable;
  return cut > 0n ? cut : 0n;
}

function pctOf(l: QuotationLine): string {
  return String(parseFloat(Number(l.discountPct).toFixed(2)));
}

type Block =
  | { kind: "group";    label: string }
  | { kind: "line";     line: QuotationLine }
  | { kind: "discount"; label: string; value: bigint };

/**
 * Lay the table out the way the studio does.
 *
 * Room names become bare caption rows. A run of consecutively discounted
 * lines is followed by its own red "LESS DIS. 25%" row and a spacer —
 * which is exactly where the sample puts it: after the two fabric lines
 * it applies to, above the track and labour that it does not. A run
 * whose lines carry different percentages has no single number to name,
 * so that row reads "LESS DISCOUNT" and lets the figure speak.
 */
function layout(lines: QuotationLine[]): Block[] {
  const blocks: Block[] = [];
  let lastRoom: string | null = null;

  // Open discount run: what it totals and which percentages built it.
  let runTotal = 0n;
  let runPcts = new Set<string>();

  function closeRun(): void {
    if (runTotal === 0n) return;
    const only = runPcts.size === 1 ? [...runPcts][0] : null;
    blocks.push({
      kind:  "discount",
      label: only ? `LESS DIS. ${only}%` : "LESS DISCOUNT",
      value: -runTotal,
    });
    runTotal = 0n;
    runPcts = new Set();
  }

  for (const line of lines) {
    const cut = cutOf(line);
    // A line with no discount ends the run before it prints.
    if (cut === 0n) closeRun();

    const room = line.roomLabel?.trim() || null;
    if (room && room !== lastRoom) {
      closeRun();
      blocks.push({ kind: "group", label: room.toUpperCase() });
      lastRoom = room;
    }

    blocks.push({ kind: "line", line });
    if (cut > 0n) { runTotal += cut; runPcts.add(pctOf(line)); }
  }
  closeRun();

  return blocks;
}

interface Props { quotation: QuotationDetail; logoSrc?: string }

export function QuotePdf({ quotation: q, logoSrc }: Props) {
  const estimate = isEstimate(q.lines);
  const blocks   = layout(q.lines);

  // TOTAL is the AMT column added up. See the tax note at the top.
  const printedTotal = q.taxableAmount;

  // A quotation's own terms still win when someone has written them.
  const customTerms = q.termsText
    ? q.termsText.split("\n").map((t) => t.trim()).filter(Boolean)
    : null;

  const area = q.siteArea ?? q.projectName ?? "";

  return (
    <Document
      title={`${estimate ? "Estimate" : "Quotation"} ${q.number}`}
      author="Mandovara"
      creator="Mandovara Interior OS"
    >
      <Page size="A4" style={s.page}>

        {/* ── Letterhead ───────────────────────────────────────────── */}
        {logoSrc
          ? <Image src={logoSrc} style={s.letterhead} />
          : <Text style={s.letterheadFallback}>Mandovara</Text>}

        {/* ── Who and where ────────────────────────────────────────── */}
        {/* Same two facts the yellow bars carried — the client with
            their number, and the area — set as one block instead of two
            shouting bands. */}
        <View style={s.headRow}>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>QUOTATION FOR</Text>
            <Text style={s.partyName}>{q.clientName}</Text>
            <Text style={s.partyMeta}>
              {[q.clientMobile, area].filter(Boolean).join("  ·  ")}
            </Text>
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
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>TOTAL</Text>
            <Text style={s.totalValue}>{amt(printedTotal)}</Text>
          </View>
        </View>

        {/* ── Terms ────────────────────────────────────────────────── */}
        <View style={s.termsWrap}>
          {estimate && <Text style={s.caveat}>{ESTIMATE_CAVEAT}</Text>}

          <Text style={s.termsHead}>TERMS &amp; CONDITIONS</Text>
          {(customTerms ?? MANDOVARA_TERMS).map((t, i) => (
            <View key={i} style={s.termRow}>
              <Text style={s.termNum}>{i + 1}.</Text>
              <Text style={!customTerms && i === EMPHASISED_TERM ? s.termStrong : s.termText}>
                {t}
              </Text>
            </View>
          ))}

          {!customTerms && (
            <>
              <Text style={s.policyHead}>{CANCELLATION_HEADING.toUpperCase()}</Text>
              {CANCELLATION_TERMS.map((t, i) => (
                <View key={i} style={s.termRow}>
                  <Text style={s.termNum}>{i + 1}.</Text>
                  <Text style={s.termText}>{t}</Text>
                </View>
              ))}
              {CLOSING_LINES.map((t, i) => (
                <Text key={i} style={s.closing}>{t}</Text>
              ))}
            </>
          )}
        </View>

      </Page>
    </Document>
  );
}
