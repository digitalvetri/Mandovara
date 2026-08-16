"use client";

export const SELL_UNITS = ["METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT"] as const;
export const UNIT_SHORT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

let _keyN = 0;
export const newKey = () => `k-${++_keyN}`;

export function paiseToRupees(p: string): string {
  try {
    const n = BigInt(p);
    const r = n / 100n;
    const f = n % 100n;
    if (f === 0n) return r.toString();
    return `${r}.${f.toString().padStart(2, "0")}`;
  } catch { return "0"; }
}

export function fmtRupee(n: number): string {
  if (!isFinite(n)) return "₹0";
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  const s = abs.toString();
  let g: string;
  if (s.length <= 3) { g = s; }
  else { const l3 = s.slice(-3); g = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + l3; }
  return neg ? `(₹${g})` : `₹${g}`;
}

export function lineAmt(l: EditLine): { taxable: number; amount: number } {
  const qty = parseFloat(l.quantity) || 0;
  const rate = parseFloat(l.rate) || 0;
  const disc = parseFloat(l.discountPct) || 0;
  const gst = parseFloat(l.gstRate) || 0;
  const taxable = qty * rate * (1 - disc / 100);
  return { taxable, amount: taxable * (1 + gst / 100) };
}

export function computeTotals(lines: EditLine[], isIntraState: boolean): PreviewTotals {
  let taxable = 0, cgst = 0, sgst = 0, igst = 0;
  for (const l of lines) {
    const { taxable: t } = lineAmt(l);
    const tax = t * (parseFloat(l.gstRate) || 0) / 100;
    taxable += t;
    if (isIntraState) { cgst += tax / 2; sgst += tax / 2; } else { igst += tax; }
  }
  const sub = taxable + cgst + sgst + igst;
  const roundOff = Math.round(sub) - sub;
  return { taxable, cgst, sgst, igst, roundOff, total: sub + roundOff };
}

import type { SerializedQuotation } from "../_types";
import type { EditLine, PreviewTotals } from "./QuotePreviewA4";

export function initLines(sLines: SerializedQuotation["lines"]): EditLine[] {
  return sLines.map((l) => ({
    _key: l.id,
    description: l.description,
    roomLabel: l.roomLabel ?? "",
    quantity: l.quantity,
    unit: l.unit,
    rate: paiseToRupees(l.rateStr),
    gstRate: l.gstRate,
    discountPct: l.discountPct,
    isOptional: l.isOptional,
  }));
}

export const INPUT = "w-full h-10 px-3 rounded-[7px] bg-ink/30 border border-rule text-text text-[13.5px] tabular outline-none focus:border-accent transition-colors";
export const INPUT_SM = "w-full h-8 px-2.5 rounded-[6px] bg-ink/30 border border-rule text-text text-[12.5px] outline-none focus:border-accent transition-colors";

export function TRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between items-baseline text-[13.5px]">
      <span className="text-text-dim">{k}</span>
      <span className="tabular font-medium text-text">{fmtRupee(v)}</span>
    </div>
  );
}

// ── Indian state codes for Tax & Details display ───────────────────────────

export const INDIAN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir",  "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh",       "05": "Uttarakhand",       "06": "Haryana",
  "07": "Delhi",            "08": "Rajasthan",          "09": "Uttar Pradesh",
  "10": "Bihar",            "11": "Sikkim",             "12": "Arunachal Pradesh",
  "13": "Nagaland",         "14": "Manipur",            "15": "Mizoram",
  "16": "Tripura",          "17": "Meghalaya",          "18": "Assam",
  "19": "West Bengal",      "20": "Jharkhand",          "21": "Odisha",
  "22": "Chhattisgarh",     "23": "Madhya Pradesh",     "24": "Gujarat",
  "26": "Daman & Diu",      "27": "Maharashtra",        "28": "Andhra Pradesh",
  "29": "Karnataka",        "30": "Goa",                "31": "Lakshadweep",
  "32": "Kerala",           "33": "Tamil Nadu",         "34": "Puducherry",
  "35": "A&N Islands",      "36": "Telangana",          "37": "Andhra Pradesh",
};

export function stateLabel(code: string): string {
  const name = INDIAN_STATES[code];
  return name ? `${name} (${code})` : code || "—";
}

// ── Tax & Details section (extracted to stay under the 300-line limit) ─────

export function TaxDetails({
  posCode,
  setPosCode,
  isIntraState,
  isDraft,
}: {
  posCode: string;
  setPosCode: (v: string) => void;
  isIntraState: boolean;
  isDraft: boolean;
}) {
  return (
    <div className="border-t border-rule px-7 py-5">
      <div className="text-[11.5px] uppercase tracking-[0.1em] text-text-dim mb-4">
        Tax &amp; Details
      </div>
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim mb-1.5">
            Place of Supply
          </div>
          {isDraft ? (
            <div className="flex items-center gap-2.5">
              <input
                type="text"
                maxLength={2}
                value={posCode}
                onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                className="h-8 w-12 px-2 rounded-[6px] border border-rule bg-transparent text-[13px] tabular text-text text-center outline-none focus:border-accent transition-colors"
              />
              <span className="text-[13px] text-text-dim">{stateLabel(posCode)}</span>
            </div>
          ) : (
            <div className="text-[13px] text-text tabular">{stateLabel(posCode)}</div>
          )}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim mb-1.5">
            Tax Type
          </div>
          <div className="text-[13px] text-text">
            {isIntraState ? "Intra-state" : "Inter-state"}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-text-dim mb-1.5">
            GST Type
          </div>
          <div className="text-[13px] text-text">
            {isIntraState ? "CGST + SGST" : "IGST"}
          </div>
        </div>
      </div>
    </div>
  );
}
