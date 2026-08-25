"use client";

// A single row of the quotation builder. Two flavours:
//   1. measurement-driven — description is the measurement label,
//      quantity comes from CalcResult.materialQty. Product picker
//      inline; rate follows the picked colourway. Rate remains editable
//      because designers routinely apply project-specific pricing.
//   2. manual (services, accessories) — everything free-form.

import { X, Package, Plus } from "lucide-react";
import { formatINR } from "@/kernel/money/format";
import type { LineInput } from "./quotation-line-types";
import { SELL_UNITS } from "@/modules/quotations/schema";
import { Td } from "./_builder-primitives";

interface Props {
  index:     number;
  line:      LineInput;
  isOnly:    boolean;
  onChange:  (i: number, f: keyof LineInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onRemove:  (i: number) => void;
  onPickProduct: (i: number) => void;
}

export function LineRow({ index, line, isOnly, onChange, onRemove, onPickProduct }: Props) {
  const isMeasurement = !!line.measurementItemId;
  const hasProduct    = !!line.colourwayId;

  return (
    <tr className="border-b border-rule/60 last:border-0 align-middle">
      <Td>
        <span className="tabular text-text-muted text-[11px]">{index + 1}</span>
      </Td>

      <Td>
        {/* Description: read-only label for measurement rows, editable input for manual rows */}
        {isMeasurement ? (
          <div>
            <div className="text-[12.5px] text-text font-medium">{line.description}</div>
            <div className="mt-1">
              {hasProduct ? (
                <button
                  type="button"
                  onClick={() => onPickProduct(index)}
                  className="group inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[5px] bg-gold/10 border border-gold/30 text-[11px] text-text hover:bg-gold/20 transition-colors"
                >
                  <Package size={10} strokeWidth={1.75} />
                  <span className="font-medium">{line.productLabel}</span>
                  <span className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">· change</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onPickProduct(index)}
                  className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-[5px] border border-dashed border-gold/50 bg-gold/5 text-[11px] text-gold hover:bg-gold/15 transition-colors"
                >
                  <Plus size={10} strokeWidth={2} /> Pick product
                </button>
              )}
            </div>
          </div>
        ) : (
          <input value={line.description} onChange={onChange(index, "description")}
                 placeholder="e.g. Installation charges, Delivery" className={cel} />
        )}
      </Td>

      <Td>
        <input value={line.roomLabel} onChange={onChange(index, "roomLabel")}
               placeholder="Room"
               readOnly={isMeasurement}
               className={`${cel} ${isMeasurement ? "bg-surface-2/50 text-text-muted cursor-default" : ""}`} />
      </Td>

      <Td>
        <input value={line.quantity} onChange={onChange(index, "quantity")}
               inputMode="decimal"
               readOnly={isMeasurement}
               className={`${cel} tabular text-right ${isMeasurement ? "bg-surface-2/50 text-text-muted cursor-default" : ""}`} />
      </Td>

      <Td>
        <select value={line.unit} onChange={onChange(index, "unit")}
                disabled={isMeasurement}
                className={`${cel} ${isMeasurement ? "bg-surface-2/50 text-text-muted cursor-default" : ""}`}>
          {SELL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </Td>

      <Td>
        <input value={line.rate} onChange={onChange(index, "rate")}
               inputMode="decimal" placeholder="0.00" className={`${cel} tabular text-right`} />
      </Td>

      <Td>
        <input value={line.discountPct} onChange={onChange(index, "discountPct")}
               inputMode="decimal" className={`${cel} tabular text-right`} />
      </Td>

      <Td>
        <select value={line.gstRate} onChange={onChange(index, "gstRate")} className={cel}>
          {["0","5","12","18","28"].map((r) => <option key={r} value={r}>{r}%</option>)}
        </select>
      </Td>

      <Td align="right">
        <span className="tabular text-text font-medium">{lineAmount(line)}</span>
      </Td>

      <Td>
        <button type="button" onClick={() => onRemove(index)} disabled={isOnly}
                aria-label="Remove"
                title={isMeasurement ? "Remove this measurement from the quote" : "Remove line"}
                className="h-[28px] w-[28px] grid place-items-center rounded-[4px] text-text-subtle hover:text-fault hover:bg-fault/10 disabled:opacity-30 transition-colors">
          <X size={12} />
        </button>
      </Td>
    </tr>
  );
}

function lineAmount(l: LineInput): string {
  const r = Number(l.rate.replace(/,/g, "")) || 0;
  const q = Number(l.quantity) || 0;
  const d = Number(l.discountPct) || 0;
  const taxable = r * q * (1 - d / 100);
  return formatINR(BigInt(Math.round((taxable + taxable * (Number(l.gstRate) / 100)) * 100)));
}

const cel = "w-full h-[28px] px-2 bg-surface-2 border border-border rounded-[4px] text-[12.5px] outline-none focus:border-gold transition-colors";
