// Running-total helpers for the quick-quote builder. Kept out of
// the main component so it stays under CLAUDE.md §10 300-line limit.
// Same shape as the server-side maths but rounded for the UI —
// authoritative totals come from the createQuickQuote action.

import { parseINR } from "@/kernel/money/format";

export interface LineDraft {
  key:          string;
  label:        string;
  quantity:     string;
  discountPct:  string;
  colourwayId?: string;
  displayName?: string;
  sellUnit?:    string;
  gstRate?:     number;
  ratePaise?:   string;
  rateEditable?: string;
  hex?:         string | null;
  family?:      string;
}

export function emptyLine(): LineDraft {
  return {
    key:         Math.random().toString(36).slice(2),
    label:       "",
    quantity:    "1",
    discountPct: "0",
    gstRate:     18,
    sellUnit:    "METRE",
  };
}

export function lineAmount(l: LineDraft): bigint {
  if (!l.rateEditable) return 0n;
  try {
    const rate  = parseINR(l.rateEditable);
    const qty   = parseFloat(l.quantity) || 0;
    const gross = (rate * BigInt(Math.round(qty * 10_000))) / 10_000n;
    const disc  = (parseFloat(l.discountPct) || 0) / 100;
    const taxable = disc > 0 ? BigInt(Math.round(Number(gross) * (1 - disc))) : gross;
    const gst = BigInt(Math.round(Number(taxable) * ((l.gstRate ?? 0) / 100)));
    return taxable + gst;
  } catch {
    return 0n;
  }
}

export function runningTotals(lines: LineDraft[]): { taxable: bigint; gst: bigint; total: bigint } {
  let taxable = 0n, gst = 0n;
  for (const l of lines) {
    if (!l.rateEditable) continue;
    try {
      const rate  = parseINR(l.rateEditable);
      const qty   = parseFloat(l.quantity) || 0;
      const gross = (rate * BigInt(Math.round(qty * 10_000))) / 10_000n;
      const disc  = (parseFloat(l.discountPct) || 0) / 100;
      const t = disc > 0 ? BigInt(Math.round(Number(gross) * (1 - disc))) : gross;
      const g = BigInt(Math.round(Number(t) * ((l.gstRate ?? 0) / 100)));
      taxable += t;
      gst     += g;
    } catch {
      /* skip malformed line */
    }
  }
  return { taxable, gst, total: taxable + gst };
}
