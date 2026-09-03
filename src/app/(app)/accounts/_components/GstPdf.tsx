// One month's GST filing, as a PDF the accountant can hand to the CA.
//
// Owner instruction, 2026-09-04: the GST tab already computes everything
// a GSTR-3B needs, but the only way to get it out of the app was a
// screenshot. This is the same figures, in the order a filing is worked
// through — net payable first, then the outward supplies it came from,
// the HSN rollup GSTR-1 asks for, and the input credit claimed against
// it.
//
// Every value arrives pre-formatted as a string. Money is BigInt paise
// everywhere behind this component and stays that way until formatINR
// runs in the route (CLAUDE.md #8) — nothing here does arithmetic.
//
// Styles are shared with the business report rather than redefined, so
// the two documents a studio sends out look like they came from the same
// office.

import { Document, Page, View, Text, Image } from "@react-pdf/renderer";
import { s, ADDR, BRAND, MUTED, BAD } from "../../reports/_components/ReportPdfStyles";

export interface GstPdfLine {
  a: string;   // invoice number / date / HSN — first column
  b: string;   // date / client / rate      — second column
  c: string;   // client / description      — third column
  taxable: string;
  cgst:    string;
  sgst:    string;
  igst:    string;
}

export interface GstPdfProps {
  periodLabel: string;
  generatedAt: string;
  logoSrc?:    string;
  /** GSTIN of the studio, when one is on file. */
  gstin:       string | null;
  totals: {
    outputTaxable: string;
    outputCgst:    string;
    outputSgst:    string;
    outputIgst:    string;
    totalOutput:   string;
    inputTaxable:  string;
    inputCgst:     string;
    inputSgst:     string;
    inputIgst:     string;
    totalInput:    string;
    netCgst:       string;
    netSgst:       string;
    netIgst:       string;
    netPayable:    string;
  };
  outputLines: GstPdfLine[];
  hsnLines:    GstPdfLine[];
  inputLines:  GstPdfLine[];
}

// Column widths, shared by every table so the three read as one document.
const W = { a: 78, b: 74, c: 96, num: 60 };

function Head({ a, b, c }: { a: string; b: string; c: string }) {
  return (
    <View style={s.thead}>
      <Text style={[s.th, { width: W.a }]}>{a}</Text>
      <Text style={[s.th, { width: W.b }]}>{b}</Text>
      <Text style={[s.th, { flex: 1 }]}>{c}</Text>
      <Text style={[s.th, { width: W.num, textAlign: "right" }]}>TAXABLE</Text>
      <Text style={[s.th, { width: W.num, textAlign: "right" }]}>CGST</Text>
      <Text style={[s.th, { width: W.num, textAlign: "right" }]}>SGST</Text>
      <Text style={[s.th, { width: W.num, textAlign: "right" }]}>IGST</Text>
    </View>
  );
}

function Line({ l }: { l: GstPdfLine }) {
  const num = { width: W.num, textAlign: "right" as const, fontSize: 7.5 };
  return (
    <View style={s.tr} wrap={false}>
      <Text style={{ width: W.a, fontSize: 7.5 }}>{l.a}</Text>
      <Text style={{ width: W.b, fontSize: 7.5, color: MUTED }}>{l.b}</Text>
      <Text style={{ flex: 1, fontSize: 7.5 }}>{l.c}</Text>
      <Text style={num}>{l.taxable}</Text>
      <Text style={[num, { color: MUTED }]}>{l.cgst}</Text>
      <Text style={[num, { color: MUTED }]}>{l.sgst}</Text>
      <Text style={[num, { color: MUTED }]}>{l.igst}</Text>
    </View>
  );
}

function TotalLine({
  label, taxable, cgst, sgst, igst,
}: { label: string; taxable: string; cgst: string; sgst: string; igst: string }) {
  const num = { width: W.num, textAlign: "right" as const, fontSize: 7.5, fontWeight: "bold" as const };
  return (
    <View style={[s.tr, { borderBottomWidth: 0, borderTopWidth: 0.75, borderTopColor: BRAND }]}>
      <Text style={{ flex: 1, fontSize: 7.5, fontWeight: "bold" }}>{label}</Text>
      <Text style={num}>{taxable}</Text>
      <Text style={num}>{cgst}</Text>
      <Text style={num}>{sgst}</Text>
      <Text style={num}>{igst}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <View style={s.secHead}><Text style={s.secTitle}>{title}</Text></View>
      <View style={s.tableWrap}>{children}</View>
    </>
  );
}

export function GstPdf({
  periodLabel, generatedAt, logoSrc, gstin, totals,
  outputLines, hsnLines, inputLines,
}: GstPdfProps) {
  return (
    <Document
      title={`Mandovara GST — ${periodLabel}`}
      author="Mandovara"
      creator="Mandovara"
    >
      <Page size="A4" style={s.page}>
        <View style={s.stripe} />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ width: 200 }}>
            {logoSrc
              ? <Image src={logoSrc} style={s.logoImg} />
              : <Text style={{ fontSize: 18, fontWeight: "bold", color: BRAND }}>Mandovara</Text>}
            <Text style={s.logoTagline}>INTERIORS · COIMBATORE</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportEye}>GST SUMMARY</Text>
            <Text style={s.reportTitle}>{periodLabel}</Text>
            {gstin && (
              <View style={s.metaRow}><Text style={s.metaLbl}>GSTIN</Text><Text style={s.metaVal}>{gstin}</Text></View>
            )}
            <View style={s.metaRow}><Text style={s.metaLbl}>GENERATED</Text><Text style={s.metaVal}>{generatedAt}</Text></View>
          </View>
        </View>

        {/* ── The three numbers the filing turns on ──────────────────── */}
        <View style={s.kpiWrap}>
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>OUTPUT TAX COLLECTED</Text>
              <Text style={s.kpiValue}>{totals.totalOutput}</Text>
              <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 3 }}>
                Taxable {totals.outputTaxable}
              </Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>INPUT CREDIT CLAIMED</Text>
              <Text style={s.kpiValue}>{totals.totalInput}</Text>
              <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 3 }}>
                Taxable {totals.inputTaxable}
              </Text>
            </View>
            <View style={s.kpiCard}>
              <Text style={s.kpiLabel}>NET PAYABLE</Text>
              <Text style={s.kpiValue}>{totals.netPayable}</Text>
              <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 3 }}>
                CGST {totals.netCgst} · SGST {totals.netSgst} · IGST {totals.netIgst}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Outward supplies ───────────────────────────────────────── */}
        <Section title="OUTPUT TAX — INVOICES ISSUED">
          <Head a="INVOICE" b="DATE" c="CLIENT" />
          {outputLines.length === 0
            ? <Text style={s.empty}>No invoices issued in {periodLabel}.</Text>
            : outputLines.map((l, i) => <Line key={`${l.a}-${i}`} l={l} />)}
          {outputLines.length > 0 && (
            <TotalLine
              label="Total output"
              taxable={totals.outputTaxable}
              cgst={totals.outputCgst}
              sgst={totals.outputSgst}
              igst={totals.outputIgst}
            />
          )}
        </Section>

        {/* ── HSN rollup ─────────────────────────────────────────────── */}
        {hsnLines.length > 0 && (
          <Section title="HSN SUMMARY — FOR GSTR-1">
            <Head a="HSN / SAC" b="RATE" c="" />
            {hsnLines.map((l, i) => <Line key={`${l.a}-${i}`} l={l} />)}
          </Section>
        )}

        {/* ── Input credit ───────────────────────────────────────────── */}
        <Section title="INPUT CREDIT — EXPENSES WITH GST">
          <Head a="DATE" b="CATEGORY" c="DESCRIPTION" />
          {inputLines.length === 0
            ? <Text style={s.empty}>No GST-captured expenses in {periodLabel}.</Text>
            : inputLines.map((l, i) => <Line key={`${l.a}-${i}`} l={l} />)}
          {inputLines.length > 0 && (
            <TotalLine
              label="Total input credit"
              taxable={totals.inputTaxable}
              cgst={totals.inputCgst}
              sgst={totals.inputSgst}
              igst={totals.inputIgst}
            />
          )}
        </Section>

        {/* ── GSTR-3B ────────────────────────────────────────────────── */}
        <View style={s.divider} />
        <Section title="GSTR-3B — NET PAYABLE THIS MONTH">
          <View style={s.finRow}>
            <Text style={s.finLabel}>CGST payable  (output {totals.outputCgst} − input {totals.inputCgst})</Text>
            <Text style={s.finValue}>{totals.netCgst}</Text>
          </View>
          <View style={s.finRow}>
            <Text style={s.finLabel}>SGST payable  (output {totals.outputSgst} − input {totals.inputSgst})</Text>
            <Text style={s.finValue}>{totals.netSgst}</Text>
          </View>
          <View style={s.finRow}>
            <Text style={s.finLabel}>IGST payable  (output {totals.outputIgst} − input {totals.inputIgst})</Text>
            <Text style={s.finValue}>{totals.netIgst}</Text>
          </View>
          <View style={s.finRowLast}>
            <Text style={[s.finLabel, { fontWeight: "bold" }]}>Total net payable to government</Text>
            <Text style={[s.finValue, { fontSize: 11 }]}>{totals.netPayable}</Text>
          </View>
          {/* The same caveat the screen carries. A PDF gets forwarded to
              people who never saw the screen, so it has to travel with
              the document rather than stay behind on the tab. */}
          <Text style={{ fontSize: 6.5, color: BAD, marginTop: 8 }}>
            Estimate only. Carry-forward credits, RCM liability and advances from prior
            months are not reflected — confirm final figures with your CA.
          </Text>
        </Section>

        <View style={s.footer} fixed>
          <View style={s.footerRow}>
            <Text style={s.footerBrand}>Mandovara Interiors</Text>
            <Text style={s.footerText}>{ADDR}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
