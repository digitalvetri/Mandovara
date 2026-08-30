// Live HTML preview of the A4 quotation — updates as the user edits.
// Pure presentational; no server calls. Rendered at 595px wide and scaled
// down to fit the preview panel via CSS zoom in workspace-helpers.tsx.
//
// Mirrors QuotePdf.tsx. An operator checking the layout on screen and a
// client opening the attachment must be looking at the same paper —
// they diverged once already and it is not worth repeating.
//
// Redesigned alongside the PDF on 2026-08-30: one teal accent instead of
// yellow fills and red text, hairline horizontal rules instead of a box
// around every cell, figures right-aligned, and the total lifted out of
// the table into its own block. Same content throughout.
//
// Everything structural is decided in the PDF and copied here — the
// columns, the "LESS DIS. 25%" run behaviour, and the TOTAL being the
// taxable sum so the column adds up on a page that shows no tax. Change
// one, change the other.

import type { SerializedQuotation } from "../_types";
import { isEstimate } from "@/modules/quotations/lib";
import { PreviewTerms } from "./PreviewTerms";

const BRAND      = "#1B8A7E";
const BRAND_DEEP = "#14655C";
const BRAND_TINT = "#EEF7F5";
const INK        = "#1A1A1A";
const INK_SOFT   = "#5B6470";
const RULE_SOFT  = "#EDF0F2";
const DEDUCT     = "#B3261E";
const WHITE      = "#FFFFFF";

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
  return neg ? `\u2212${body}` : body;
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
  | { kind: "discount"; label: string; value: number };

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
  borderBottom: `0.5px solid ${RULE_SOFT}`,
  padding: "5px 7px",
  fontSize: "9.5px",
  color: INK,
  verticalAlign: "middle",
};
const NUM: React.CSSProperties = { ...CELL, textAlign: "right" };
const MUTED: React.CSSProperties = { ...CELL, color: INK_SOFT, textAlign: "center" };
const HEAD: React.CSSProperties = {
  padding: "6.5px 7px",
  fontSize: "7.5px",
  fontWeight: 700,
  color: WHITE,
  letterSpacing: "0.9px",
  background: BRAND,
};

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
          padding: "26px 42px 28px",
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
          style={{ width: "196px", height: "115px", display: "block", marginBottom: "12px" }}
        />

        {/* ── Who and where ── */}
        <div style={{ borderLeft: `2.5px solid ${BRAND}`, paddingLeft: "10px", marginBottom: "13px" }}>
          <div style={{ fontSize: "7px", letterSpacing: "1.4px", color: INK_SOFT, marginBottom: "4px" }}>
            QUOTATION FOR
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: INK, marginBottom: "2px" }}>
            {quotation.clientName}
          </div>
          <div style={{ fontSize: "9px", color: INK_SOFT }}>
            {[quotation.clientMobile, area].filter(Boolean).join("  ·  ")}
          </div>
        </div>

        {/* ── Items ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "46%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14.5%" }} />
            <col style={{ width: "14.5%" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...HEAD, textAlign: "left" }}>ITEM</th>
              <th style={{ ...HEAD, textAlign: "center" }}>UNIT</th>
              <th style={{ ...HEAD, textAlign: "right" }}>QTY</th>
              <th style={{ ...HEAD, textAlign: "right" }}>RATE</th>
              <th style={{ ...HEAD, textAlign: "right" }}>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let n = 0;
              return rows.map((r, i) => {
                if (r.kind === "group") {
                  return (
                    <tr key={`g-${i}`} style={{ background: BRAND_TINT }}>
                      <td colSpan={5} style={{
                        ...CELL, fontSize: "7.5px", fontWeight: 700,
                        color: BRAND_DEEP, letterSpacing: "1.1px", padding: "5.5px 7px",
                      }}>
                        {r.label}
                      </td>
                    </tr>
                  );
                }
                if (r.kind === "discount") {
                  return (
                    <tr key={`d-${i}`}>
                      <td style={{ ...CELL, color: DEDUCT, fontSize: "9px" }}>{r.label}</td>
                      <td style={CELL} /><td style={CELL} /><td style={CELL} />
                      <td style={{ ...NUM, color: DEDUCT }}>{fmtAmt(r.value)}</td>
                    </tr>
                  );
                }
                const l = r.line;
                const alt = n++ % 2 === 1;
                const bg = alt ? { background: "#FAFBFC" } : {};
                return (
                  <tr key={l._key} style={bg}>
                    <td style={CELL}>{l.description || "—"}</td>
                    <td style={MUTED}>{l.unit}</td>
                    <td style={NUM}>{fmtQty(l.quantity)}</td>
                    <td style={NUM}>{fmtAmt(parseFloat(l.rate) || 0)}</td>
                    <td style={NUM}>{fmtAmt(grossOf(l))}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>

        {/* ── Total ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px", marginBottom: "15px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "45%", background: BRAND_TINT, borderTop: `1.5px solid ${BRAND}`,
            padding: "7.5px 11px",
          }}>
            <span style={{ fontSize: "8px", fontWeight: 700, color: BRAND_DEEP, letterSpacing: "1.2px" }}>
              TOTAL
            </span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: BRAND_DEEP }}>
              {fmtAmt(printedTotal)}
            </span>
          </div>
        </div>

        <PreviewTerms estimate={estimate} customTerms={customTerms} />
      </div>
    </div>
  );
}
