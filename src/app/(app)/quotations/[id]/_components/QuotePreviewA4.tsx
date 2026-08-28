// Live HTML preview of the A4 quotation — updates as the user edits.
// Pure presentational; no server calls. Rendered at 595px wide and scaled
// down to fit the preview panel via CSS zoom in workspace-helpers.tsx.
//
// Rewritten 2026-08-28 to mirror QuotePdf.tsx. It had been showing the
// old GST tax-quotation — teal header, Bill To / From boxes, a GST%
// column and a CGST/SGST totals stack — while the PDF now produces the
// studio's own document. An operator checking the layout on screen and
// a client opening the attachment were looking at two different papers.
//
// Everything structural here is decided in the PDF and copied: the same
// two yellow bands, the same ITEM/Unit/QTY/RATE/AMT columns, the same
// "LESS DIS. 25%" run behaviour, and the same TOTAL — the taxable sum,
// so the column adds up on a page that shows no tax. Change one, change
// the other; they are the same document in two media.

import type { SerializedQuotation } from "../_types";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import {
  MANDOVARA_TERMS, EMPHASISED_TERM, CANCELLATION_HEADING,
  CANCELLATION_TERMS, CLOSING_LINES,
} from "./_quote-terms";

const INK    = "#000000";
const RED    = "#FF0000";
const YELLOW = "#FFFF00";
const WHITE  = "#FFFFFF";

export interface EditLine {
  _key: string;
  description: string;
  roomLabel: string;
  quantity: string;
  unit: string;
  rate: string;
  gstRate: string;
  discountPct: string;
  isOptional: boolean;
}

export interface PreviewTotals {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
}

/** Indian grouping, no ₹ symbol, paise only when there are any — the
 *  same rule as amt() in _pdf-table.tsx. */
function fmtAmt(n: number): string {
  if (!isFinite(n)) return "0";
  const neg = n < 0;
  const abs = Math.abs(n);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const s = rupees.toString();
  const grouped = s.length <= 3
    ? s
    : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3);

  const body = paise === 0 ? grouped : `${grouped}.${String(paise).padStart(2, "0")}`;
  return neg ? `-${body}` : body;
}

function fmtQty(q: string): string {
  const n = parseFloat(q);
  if (!isFinite(n)) return q || "";
  return Number.isInteger(n) ? n.toString() : String(parseFloat(n.toFixed(2)));
}

/** Undiscounted line value — what the AMT column prints. */
function grossOf(l: EditLine): number {
  return (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
}
function cutOf(l: EditLine): number {
  const d = parseFloat(l.discountPct) || 0;
  return grossOf(l) * (d / 100);
}

type Row =
  | { kind: "group";    label: string }
  | { kind: "line";     line: EditLine }
  | { kind: "discount"; label: string; value: number }
  | { kind: "spacer" };

/** Mirror of layout() in QuotePdf.tsx — see the note at the top. */
function layout(lines: EditLine[]): Row[] {
  const rows: Row[] = [];
  let lastRoom: string | null = null;
  let runTotal = 0;
  let runPcts = new Set<string>();

  function closeRun(): void {
    if (runTotal <= 0) return;
    const only = runPcts.size === 1 ? [...runPcts][0] : null;
    rows.push({
      kind: "discount",
      label: only ? `LESS DIS. ${only}%` : "LESS DISCOUNT",
      value: -runTotal,
    });
    rows.push({ kind: "spacer" });
    runTotal = 0;
    runPcts = new Set();
  }

  for (const line of lines) {
    const cut = cutOf(line);
    if (cut <= 0) closeRun();

    const room = line.roomLabel?.trim() || null;
    if (room && room !== lastRoom) {
      closeRun();
      rows.push({ kind: "group", label: room.toUpperCase() });
      lastRoom = room;
    }

    rows.push({ kind: "line", line });
    if (cut > 0) {
      runTotal += cut;
      runPcts.add(String(parseFloat((parseFloat(line.discountPct) || 0).toFixed(2))));
    }
  }
  closeRun();
  return rows;
}

const CELL: React.CSSProperties = {
  border: `0.75px solid ${INK}`,
  padding: "3px 4px",
  textAlign: "center",
  fontSize: "9px",
  verticalAlign: "middle",
};
const HEAD: React.CSSProperties = { ...CELL, fontWeight: 700, color: RED };
const REDCELL: React.CSSProperties = { ...CELL, fontWeight: 700, color: RED };

interface Props {
  quotation: SerializedQuotation;
  lines: EditLine[];
  totals: PreviewTotals;
  /** Still accepted so callers need no change, but no longer read: the
   *  sheet shows no tax, so CGST+SGST vs IGST makes no difference to it.
   *  The operator-facing summary bar still breaks tax out. */
  isIntraState?: boolean;
}

export function QuotePreviewA4({ quotation, lines, totals }: Props) {
  const rows = layout(lines);
  // Same figure the PDF prints: the AMT column added up, tax excluded.
  const printedTotal = totals.taxable;
  const headline = [quotation.clientName, quotation.clientMobile].filter(Boolean).join(" - ");
  const area = quotation.siteArea ?? quotation.projectName ?? "";
  const customTerms = quotation.termsText
    ? quotation.termsText.split("\n").map((t) => t.trim()).filter(Boolean)
    : null;
  // Read off the saved lines, not the edit buffer: EditLine carries no
  // measurement link. The PDF prints this caveat, so the preview must
  // too, or the operator is again checking a different document.
  const estimate = isEstimate(quotation.lines);

  return (
    <div style={{ padding: "12px 0 20px" }}>
      <div
        style={{
          width: "595px",
          minHeight: "842px",
          background: WHITE,
          boxShadow: "0 4px 28px rgba(0,0,0,0.14)",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: "9px",
          color: INK,
          margin: "0 auto",
          padding: "34px 46px 40px",
          boxSizing: "border-box",
        }}
      >
        {/* ── Letterhead ── */}
        {/* Plain <img>, not next/image: this block is measured in exact
            pixels and CSS-zoomed as a unit to fake an A4 sheet, which
            next/image's wrapper and srcset would fight. */}
        <img
          src="/mandovara-letterhead.jpg"
          alt="Mandovara"
          style={{ width: "340px", height: "199px", display: "block" }}
        />

        {/* ── Who and where ── */}
        <div style={{ background: YELLOW, border: `0.75px solid ${INK}`, borderBottom: "none", padding: "3px 4px", textAlign: "center", fontWeight: 700, color: RED, fontSize: "10px" }}>
          {headline}
        </div>
        <div style={{ background: YELLOW, border: `0.75px solid ${INK}`, padding: "3px 4px", textAlign: "center", fontWeight: 700, color: RED, fontSize: "10px" }}>
          {area.toUpperCase()}
        </div>

        {/* ── Items ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "44%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              {(["ITEM", "Unit", "QTY", "RATE", "AMT"] as const).map((h) => (
                <th key={h} style={HEAD}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              if (r.kind === "group") {
                return (
                  <tr key={`g-${i}`}>
                    <td style={CELL}>{r.label}</td>
                    <td style={CELL} /><td style={CELL} /><td style={CELL} /><td style={CELL} />
                  </tr>
                );
              }
              if (r.kind === "spacer") {
                return (
                  <tr key={`s-${i}`} style={{ height: "15px" }}>
                    <td style={CELL} /><td style={CELL} /><td style={CELL} /><td style={CELL} /><td style={CELL} />
                  </tr>
                );
              }
              if (r.kind === "discount") {
                return (
                  <tr key={`d-${i}`}>
                    <td style={REDCELL}>{r.label}</td>
                    <td style={CELL} /><td style={CELL} /><td style={CELL} />
                    <td style={REDCELL}>{fmtAmt(r.value)}</td>
                  </tr>
                );
              }
              const l = r.line;
              return (
                <tr key={l._key}>
                  <td style={CELL}>{l.description || "—"}</td>
                  <td style={CELL}>{l.unit}</td>
                  <td style={CELL}>{fmtQty(l.quantity)}</td>
                  <td style={CELL}>{fmtAmt(parseFloat(l.rate) || 0)}</td>
                  <td style={CELL}>{fmtAmt(grossOf(l))}</td>
                </tr>
              );
            })}

            <tr>
              <td style={REDCELL}>TOTAL</td>
              <td style={CELL} /><td style={CELL} /><td style={CELL} />
              <td style={REDCELL}>{fmtAmt(printedTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Terms ── */}
        <div style={{ marginTop: "14px", fontSize: "8.5px", lineHeight: 1.35 }}>
          {estimate && (
            <div style={{ marginBottom: "6px", fontWeight: 700, color: RED }}>
              {ESTIMATE_CAVEAT}
            </div>
          )}

          {(customTerms ?? MANDOVARA_TERMS).map((t, i) => (
            <div
              key={i}
              style={{
                marginBottom: "4px",
                ...(!customTerms && i === EMPHASISED_TERM ? { fontWeight: 700, color: RED } : {}),
              }}
            >
              {i + 1}. {t}
            </div>
          ))}

          {!customTerms && (
            <>
              <div style={{ marginTop: "6px", marginBottom: "4px", fontWeight: 700, color: RED, fontSize: "9px" }}>
                {CANCELLATION_HEADING}
              </div>
              {CANCELLATION_TERMS.map((t, i) => (
                <div key={i} style={{ marginBottom: "4px" }}>{i + 1}.{t}</div>
              ))}
              {CLOSING_LINES.map((t, i) => (
                <div key={i} style={{ marginTop: "4px" }}>{t}</div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
