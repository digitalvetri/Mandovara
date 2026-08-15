"use client";

import { useRef, useState, useEffect } from "react";
import { FileText, Download } from "lucide-react";
import { QuotePreviewA4, type EditLine, type PreviewTotals } from "./QuotePreviewA4";
import type { SerializedQuotation } from "../_types";

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

export const INPUT = "w-full h-7 px-2 rounded-[5px] bg-ink/30 border border-rule text-text text-[12px] tabular outline-none focus:border-[#2BA89A] transition-colors";
export const INPUT_SM = `${INPUT} text-[11px]`;

export function TRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-[11.5px]">
      <span className="text-text-dim">{k}</span>
      <span className="tabular text-text">{fmtRupee(v)}</span>
    </div>
  );
}

export function PreviewPanel({
  quotation, lines, totals, isIntraState,
}: {
  quotation: SerializedQuotation;
  lines: EditLine[];
  totals: PreviewTotals;
  isIntraState: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.62);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, Math.max(0.4, (el.clientWidth - 24) / 595)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="hidden lg:flex flex-col border-l border-rule shrink-0"
      style={{ width: "44%", minWidth: "380px" }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-rule bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={13} strokeWidth={1.8} className="text-text-dim" />
          <span className="text-[11px] text-text-dim uppercase tracking-[0.1em]">Live Preview</span>
        </div>
        <a
          href={`/api/quotations/${quotation.id}/pdf`}
          download
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[11.5px] font-medium border transition-colors"
          style={{ color: "#2BA89A", borderColor: "rgba(43,168,154,0.3)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(43,168,154,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <Download size={12} strokeWidth={2} />
          PDF
        </a>
      </div>

      {/* Scaled A4 canvas */}
      <div ref={wrapRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#D8E0DF]">
        <div style={{ zoom: scale }}>
          <QuotePreviewA4
            quotation={quotation}
            lines={lines}
            totals={totals}
            isIntraState={isIntraState}
          />
        </div>
      </div>
    </div>
  );
}
