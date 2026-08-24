// Live HTML preview of the A4 quotation — updates as the user edits.
// Pure presentational; no server calls. Rendered at 595px wide and scaled
// down to fit the preview panel via CSS zoom in workspace-helpers.tsx.

import type { SerializedQuotation } from "../_types";

const TEAL  = "#1B8A7E";
const INK   = "#111827";
const MUTED = "#64748B";
const BORD  = "#E2E8F0";
const STRIP = "#F8FAFC";
const WHITE = "#FFFFFF";

const UNIT_SHORT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

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

function fmtRupee(n: number): string {
  if (!isFinite(n)) return "₹0";
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  const s = abs.toString();
  const l3 = s.slice(-3);
  const grouped = s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + l3;
  return neg ? `(₹${grouped})` : `₹${grouped}`;
}

function computeLine(l: EditLine) {
  const qty  = parseFloat(l.quantity)    || 0;
  const rate = parseFloat(l.rate)        || 0;
  const disc = parseFloat(l.discountPct) || 0;
  const gst  = parseFloat(l.gstRate)    || 0;
  const taxable = qty * rate * (1 - disc / 100);
  return { taxable, amount: taxable * (1 + gst / 100) };
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

interface Props {
  quotation: SerializedQuotation;
  lines: EditLine[];
  totals: PreviewTotals;
  isIntraState: boolean;
}

export function QuotePreviewA4({ quotation, lines, totals, isIntraState }: Props) {
  const taxRows: Array<{ label: string; v: number }> = [
    { label: "Taxable Amount", v: totals.taxable },
    ...(isIntraState
      ? [{ label: "CGST", v: totals.cgst }, { label: "SGST", v: totals.sgst }]
      : [{ label: "IGST", v: totals.igst }]),
    ...(Math.abs(totals.roundOff) > 0.004 ? [{ label: "Round-off", v: totals.roundOff }] : []),
  ];

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
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── HEADER ── */}
        <div style={{ padding: "22px 32px 16px", borderBottom: `2px solid ${TEAL}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "5px", background: TEAL, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: WHITE, fontSize: "18px", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>M</span>
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: INK, letterSpacing: "0.02em", lineHeight: 1.15 }}>Mandovara</div>
              <div style={{ fontSize: "6.5px", color: MUTED, letterSpacing: "0.22em", marginTop: "3px", textTransform: "uppercase" }}>Interiors · Coimbatore</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: TEAL, letterSpacing: "0.12em", textTransform: "uppercase" }}>Quotation</div>
            <div style={{ fontSize: "8.5px", color: MUTED, marginTop: "4px", fontFamily: "monospace" }}>{quotation.number}</div>
            {quotation.revision > 0 && <div style={{ fontSize: "7.5px", color: MUTED, marginTop: "2px" }}>Revision {quotation.revision}</div>}
          </div>
        </div>

        {/* ── META STRIP ── */}
        <div style={{ display: "flex", background: STRIP, padding: "8px 32px", borderBottom: `1px solid ${BORD}` }}>
          {[
            { label: "Quote No.", value: quotation.number, mono: true },
            { label: "Date", value: fmtDate(quotation.date) },
            { label: "Valid Until", value: fmtDate(quotation.validUntil) },
            { label: "Branch", value: quotation.branchName },
          ].map(({ label, value, mono }) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ fontSize: "6.5px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTED, marginBottom: "3px" }}>{label}</div>
              <div style={{ fontSize: "9px", fontWeight: 700, fontFamily: mono ? "monospace" : undefined }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── BILL TO / FROM ── */}
        <div style={{ display: "flex", gap: "10px", padding: "12px 32px", borderBottom: `1px solid ${BORD}` }}>
          {/* Bill To */}
          <div style={{ flex: 1, padding: "8px 10px", border: `1px solid ${BORD}`, borderRadius: "3px", background: STRIP }}>
            <div style={{ fontSize: "6.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: TEAL, marginBottom: "5px" }}>Bill To</div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: INK, marginBottom: "2px" }}>{quotation.clientName}</div>
            <div style={{ fontSize: "8px", color: MUTED, fontFamily: "monospace" }}>{quotation.clientMobile}</div>
            {quotation.clientEmail && <div style={{ fontSize: "8px", color: MUTED, marginTop: "1px" }}>{quotation.clientEmail}</div>}
            {quotation.clientGstin && <div style={{ fontSize: "7.5px", color: MUTED, marginTop: "2px", fontFamily: "monospace" }}>GSTIN: {quotation.clientGstin}</div>}
          </div>
          {/* From */}
          <div style={{ flex: 1, padding: "8px 10px", border: `1px solid ${BORD}`, borderRadius: "3px", background: STRIP }}>
            <div style={{ fontSize: "6.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: TEAL, marginBottom: "5px" }}>From</div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: INK, marginBottom: "2px" }}>{quotation.branchName}</div>
            <div style={{ fontSize: "8px", color: MUTED }}>32 Thirumoorthy Layout, Thadagam Rd</div>
            <div style={{ fontSize: "8px", color: MUTED }}>RS Puram, Coimbatore 641002</div>
            <div style={{ fontSize: "7.5px", color: MUTED, marginTop: "2px" }}>State code {quotation.supplierStateCode} · {isIntraState ? "Intra-state" : "Inter-state"}</div>
          </div>
        </div>

        {/* ── LINE ITEMS ── */}
        <div style={{ padding: "10px 32px 8px", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "20px" }} />
              <col />
              <col style={{ width: "55px" }} />
              <col style={{ width: "88px" }} />
              <col style={{ width: "40px" }} />
              <col style={{ width: "90px" }} />
            </colgroup>
            <thead>
              <tr style={{ background: TEAL }}>
                {(["#", "Description", "Qty", "Rate ₹", "GST%", "Amount ₹"] as const).map((h, i) => (
                  <th key={h} style={{ padding: "5px 5px", fontSize: "6.5px", fontWeight: 700, color: WHITE, textAlign: i === 0 ? "center" : i >= 2 ? "right" : "left", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const { taxable } = computeLine(l);
                return (
                  <tr key={l._key} style={{ background: i % 2 === 1 ? STRIP : WHITE, borderBottom: `0.5px solid ${BORD}` }}>
                    <td style={{ padding: "4px 5px", textAlign: "center", color: MUTED, fontSize: "8px" }}>{i + 1}</td>
                    <td style={{ padding: "4px 5px", wordBreak: "break-word", lineHeight: 1.45 }}>
                      <div style={{ fontSize: "8.5px" }}>{l.description || "—"}</div>
                      {l.roomLabel && <div style={{ fontSize: "7.5px", color: MUTED, marginTop: "1px" }}>{l.roomLabel}</div>}
                      {l.isOptional && <div style={{ fontSize: "7px", color: TEAL, marginTop: "1px" }}>Optional</div>}
                    </td>
                    <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: "monospace", fontSize: "8.5px", whiteSpace: "nowrap" }}>
                      {parseFloat(l.quantity) || 0} <span style={{ color: MUTED }}>{UNIT_SHORT[l.unit] ?? l.unit.toLowerCase()}</span>
                    </td>
                    <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: "monospace", fontSize: "8.5px" }}>{fmtRupee(parseFloat(l.rate) || 0)}</td>
                    <td style={{ padding: "4px 5px", textAlign: "right", color: MUTED, fontSize: "8.5px" }}>{l.gstRate}%</td>
                    <td style={{ padding: "4px 5px", textAlign: "right", fontFamily: "monospace", fontSize: "8.5px", fontWeight: 600 }}>{fmtRupee(taxable)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
            <div style={{ width: "215px" }}>
              {taxRows.map(({ label, v }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: `0.5px solid ${BORD}`, fontSize: "8px" }}>
                  <span style={{ color: MUTED }}>{label}</span>
                  <span style={{ fontFamily: "monospace" }}>{fmtRupee(v)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", padding: "7px 10px", background: TEAL, borderRadius: "3px" }}>
                <span style={{ color: WHITE, fontWeight: 700, fontSize: "8px", letterSpacing: "0.08em" }}>GRAND TOTAL</span>
                <span style={{ color: WHITE, fontWeight: 700, fontSize: "13px", fontFamily: "monospace" }}>{fmtRupee(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms */}
        {quotation.termsText && (
          <div style={{ margin: "6px 32px 0", paddingTop: "8px", borderTop: `1px solid ${BORD}` }}>
            <div style={{ fontSize: "6.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: TEAL, marginBottom: "4px" }}>Terms &amp; Conditions</div>
            <div style={{ fontSize: "7.5px", color: MUTED, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{quotation.termsText}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: "auto", padding: "8px 32px 18px 32px", display: "flex", justifyContent: "space-between", borderTop: `1px solid ${BORD}` }}>
          <span style={{ fontSize: "7px", color: MUTED }}>mandovara.com · +91 8940430051</span>
          <span style={{ fontSize: "7px", color: MUTED }}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</span>
        </div>
      </div>
    </div>
  );
}
