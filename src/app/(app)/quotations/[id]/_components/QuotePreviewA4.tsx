// HTML simulation of the A4 quote PDF — updates live as the user edits lines.
// Pure presentational; no server calls.

import type { SerializedQuotation } from "../_types";

const TEAL = "#1B8A7E";
const MUTE = "#5A7A78";
const LITE = "#EEF8F6";
const BORD = "#C8E0DC";

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
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  const s = abs.toString();
  let grouped: string;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return neg ? `(₹${grouped})` : `₹${grouped}`;
}

function computeLine(l: EditLine) {
  const qty = parseFloat(l.quantity) || 0;
  const rate = parseFloat(l.rate) || 0;
  const disc = parseFloat(l.discountPct) || 0;
  const gst = parseFloat(l.gstRate) || 0;
  const gross = qty * rate;
  const taxable = gross * (1 - disc / 100);
  const tax = taxable * gst / 100;
  return { taxable, tax, amount: taxable + tax };
}

interface InfoItem {
  text: string;
  bold?: boolean;
  size?: string;
  muted?: boolean;
  mono?: boolean;
}

function InfoBox({ title, items }: { title: string; items: InfoItem[] }) {
  return (
    <div style={{ flex: 1, backgroundColor: "#F9FCFC", border: `1px solid ${BORD}`, borderRadius: "4px", padding: "8px 10px" }}>
      <div style={{ fontSize: "6.5px", textTransform: "uppercase", letterSpacing: "0.1em", color: TEAL, fontWeight: 700, marginBottom: "5px" }}>{title}</div>
      {items.map((bl, i) => (
        <div key={i} style={{ color: bl.muted ? MUTE : "#0F2A28", fontWeight: bl.bold ? 700 : 400, fontSize: bl.size ?? "8.5px", fontFamily: bl.mono ? "monospace" : undefined, marginTop: i > 0 ? "2px" : undefined }}>
          {bl.text}
        </div>
      ))}
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
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
    <div style={{ padding: "8px 0 20px" }}>
      <div
        style={{
          width: "595px",
          minHeight: "842px",
          background: "#FFFFFF",
          boxShadow: "0 4px 28px rgba(0,0,0,0.14)",
          fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: "9px",
          color: "#0F2A28",
          margin: "0 auto",
          overflow: "hidden",
        }}
      >
        {/* Header bar */}
        <div style={{ backgroundColor: TEAL, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#FFF", letterSpacing: "0.04em", lineHeight: 1 }}>Mandovara</div>
            <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.6)", marginTop: "4px", letterSpacing: "0.22em" }}>INTERIORS™ · COIMBATORE</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#FFF", letterSpacing: "0.12em" }}>QUOTATION</div>
            {quotation.revision > 0 && (
              <div style={{ fontSize: "7.5px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>
                Revision {quotation.revision}
              </div>
            )}
          </div>
        </div>

        {/* Meta strip */}
        <div style={{ display: "flex", backgroundColor: LITE, padding: "10px 24px", borderBottom: `1px solid ${BORD}` }}>
          {[
            { label: "Quote No.", value: quotation.number },
            { label: "Date", value: fmtDate(quotation.date) },
            { label: "Valid Until", value: fmtDate(quotation.validUntil) },
            { label: "Branch", value: quotation.branchName },
          ].map(({ label, value }) => (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ fontSize: "6.5px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTE, marginBottom: "3px" }}>{label}</div>
              <div style={{ fontSize: "9.5px", fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Client + branch boxes */}
        <div style={{ display: "flex", gap: "14px", padding: "12px 24px", borderBottom: `1px solid ${BORD}` }}>
          <InfoBox title="Bill To" items={[
            { text: quotation.clientName, bold: true, size: "10px" },
            { text: quotation.clientMobile },
            ...(quotation.clientGstin ? [{ text: `GSTIN: ${quotation.clientGstin}`, mono: true, muted: true }] : []),
          ]} />
          <InfoBox title="From" items={[
            { text: quotation.branchName, bold: true, size: "10px" },
            { text: `State code ${quotation.supplierStateCode}` },
            { text: isIntraState ? "Intra-state supply" : "Inter-state supply", muted: true },
          ]} />
        </div>

        {/* Lines table */}
        <div style={{ padding: "4px 24px 12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
            <thead>
              <tr style={{ backgroundColor: TEAL }}>
                {["#", "Description", "Qty", "Rate ₹", "GST%", "Amount"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "5px 6px",
                      fontSize: "7px",
                      fontWeight: 700,
                      color: "#FFF",
                      textAlign: i === 0 ? "center" : i >= 2 ? "right" : "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const { amount } = computeLine(l);
                return (
                  <tr
                    key={l._key}
                    style={{ backgroundColor: i % 2 === 1 ? "#F7FBFA" : "#FFF", borderBottom: `0.5px solid ${BORD}` }}
                  >
                    <td style={{ padding: "4px 6px", textAlign: "center", color: MUTE }}>{i + 1}</td>
                    <td style={{ padding: "4px 6px" }}>
                      <div>{l.description || <span style={{ color: MUTE }}>—</span>}</div>
                      {l.roomLabel && (
                        <div style={{ color: MUTE, fontSize: "7.5px", marginTop: "1px" }}>{l.roomLabel}</div>
                      )}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {parseFloat(l.quantity) || 0} <span style={{ color: MUTE }}>{UNIT_SHORT[l.unit] ?? l.unit.toLowerCase()}</span>
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "monospace" }}>
                      {fmtRupee(parseFloat(l.rate) || 0)}
                    </td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: MUTE }}>{l.gstRate}%</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {fmtRupee(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals block */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
            <div style={{ width: "210px" }}>
              {taxRows.map(({ label, v }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "2.5px 0", borderBottom: `0.5px solid ${BORD}`, fontSize: "8px" }}>
                  <span style={{ color: MUTE }}>{label}</span>
                  <span style={{ fontFamily: "monospace" }}>{fmtRupee(v)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "7px", padding: "7px 10px", backgroundColor: TEAL, borderRadius: "3px" }}>
                <span style={{ color: "#FFF", fontWeight: 700, fontSize: "8.5px", letterSpacing: "0.08em" }}>GRAND TOTAL</span>
                <span style={{ color: "#FFF", fontWeight: 700, fontSize: "13px", fontFamily: "monospace" }}>{fmtRupee(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Terms */}
        {quotation.termsText && (
          <div style={{ padding: "10px 24px 0", borderTop: `1px solid ${BORD}`, margin: "0 0 0 0" }}>
            <div style={{ fontSize: "6.5px", textTransform: "uppercase", letterSpacing: "0.1em", color: MUTE, fontWeight: 700, marginBottom: "4px" }}>Terms &amp; Conditions</div>
            <div style={{ fontSize: "7.5px", color: MUTE, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{quotation.termsText}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ margin: "16px 24px 0", paddingTop: "7px", borderTop: `1px solid ${BORD}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "7px", color: MUTE }}>mandovara.com · +91 8940430051</span>
          <span style={{ fontSize: "7px", color: MUTE }}>32 Thirumoorthy Layout, RS Puram, Coimbatore 641002</span>
        </div>
        <div style={{ height: "24px" }} />
      </div>
    </div>
  );
}
