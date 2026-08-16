"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { updateQuotationLines } from "@/modules/quotations/actions";
import type { EditLine } from "./QuotePreviewA4";
import type { SerializedQuotation } from "../_types";
import {
  SELL_UNITS, UNIT_SHORT, newKey, INPUT, INPUT_SM,
  fmtRupee, lineAmt, computeTotals, initLines, TRow, TaxDetails,
} from "./workspace-helpers";

export function QuotationWorkspace({
  quotation,
  canApprove: _canApprove,
}: {
  quotation: SerializedQuotation;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState<EditLine[]>(() => initLines(quotation.lines));
  const [posCode, setPosCode] = useState(quotation.supplierStateCode);
  const [saving, startSave] = useTransition();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDraft = ["DRAFT", "REVISED"].includes(quotation.status);
  const isIntraState = posCode === quotation.supplierStateCode;
  const totals = computeTotals(lines, isIntraState);

  function update(key: string, patch: Partial<EditLine>) {
    setLines((p) => p.map((l) => l._key === key ? { ...l, ...patch } : l));
    setSaved(false);
  }

  function addLine() {
    setLines((p) => [
      ...p,
      { _key: newKey(), description: "", roomLabel: "", quantity: "1", unit: "PIECE", rate: "0", gstRate: "18", discountPct: "0", isOptional: false },
    ]);
    setSaved(false);
  }

  function removeLine(key: string) {
    setLines((p) => p.filter((l) => l._key !== key));
    setSaved(false);
  }

  function handleSave() {
    const valid = lines.filter((l) => l.description.trim());
    if (!valid.length) { setSaveErr("At least one line with a description is required"); return; }
    setSaveErr(null);
    startSave(async () => {
      const res = await updateQuotationLines({
        quotationId: quotation.id,
        placeOfSupplyCode: posCode,
        lines: valid.map((l) => ({
          description: l.description.trim(),
          roomLabel: l.roomLabel.trim() || undefined,
          quantity: parseFloat(l.quantity) || 1,
          unit: l.unit as typeof SELL_UNITS[number],
          rate: l.rate,
          gstRate: parseFloat(l.gstRate) || 0,
          discountPct: parseFloat(l.discountPct) || 0,
          isOptional: l.isOptional,
        })),
      });
      if (!res.ok) { setSaveErr(res.error ?? "Save failed"); return; }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[18px] bg-surface border border-rule overflow-hidden">

      {/* ── Section header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-7 py-4 border-b border-rule">
        <div>
          <div className="text-[14px] font-semibold text-text">Items in this quotation</div>
          <div className="text-[12.5px] text-text-dim mt-0.5">
            {lines.length} item{lines.length !== 1 ? "s" : ""}
          </div>
        </div>
        {isDraft && (
          <div className="flex items-center gap-2.5 shrink-0">
            {saveErr && (
              <span className="text-[12.5px] text-fault max-w-[200px] truncate">{saveErr}</span>
            )}
            {saved && !saving && !saveErr && (
              <span className="text-[12.5px] text-solid">Saved ✓</span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 h-9 px-5 rounded-[9px] text-[13px] font-medium text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? "#5A9A95" : "linear-gradient(135deg, #2BA89A 0%, #1A8A7E 100%)" }}
            >
              <Save size={13} strokeWidth={2.2} />
              {saving ? "Saving…" : "Save Lines"}
            </button>
          </div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="px-7 pt-6 pb-4 overflow-x-auto">
        <table className="w-full text-[13.5px] border-collapse" style={{ minWidth: "760px" }}>
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.1em] text-text-dim border-b-2 border-rule">
              <th className="text-left pb-3 pr-3 w-[44px]">#</th>
              <th className="text-left pb-3 pr-4">Item / Description</th>
              <th className="text-right pb-3 pr-3 w-[80px]">Qty</th>
              <th className="text-left pb-3 pr-3 w-[90px]">Unit</th>
              <th className="text-right pb-3 pr-3 w-[112px]">Rate (₹)</th>
              <th className="text-right pb-3 pr-3 w-[70px]">GST %</th>
              <th className="text-right pb-3 pr-3 w-[88px]">Discount %</th>
              <th className="text-right pb-3 w-[112px]">Amount</th>
              {isDraft && <th className="w-[44px]" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const { amount } = lineAmt(l);
              return (
                <tr key={l._key} className="border-b border-rule/50 group">
                  <td className="py-5 pr-3 align-top">
                    <span className="tabular text-text-dim text-[12.5px] mt-1.5 block">{idx + 1}</span>
                  </td>
                  <td className="py-5 pr-4 align-top">
                    {isDraft ? (
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          value={l.description}
                          placeholder="Item description…"
                          onChange={(e) => update(l._key, { description: e.target.value })}
                          className={INPUT}
                        />
                        <input
                          type="text"
                          value={l.roomLabel}
                          placeholder="Room (optional)"
                          onChange={(e) => update(l._key, { roomLabel: e.target.value })}
                          className={INPUT_SM}
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="text-[14.5px] text-text font-medium leading-snug">
                          {l.description}
                        </div>
                        {l.roomLabel && (
                          <div className="text-[12.5px] text-text-dim mt-1.5">{l.roomLabel}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-5 pr-3 align-top">
                    {isDraft ? (
                      <input type="number" min="0" step="any" value={l.quantity}
                        onChange={(e) => update(l._key, { quantity: e.target.value })}
                        className={`${INPUT} text-right`} />
                    ) : (
                      <span className="tabular block text-right text-[14px] mt-1">{l.quantity}</span>
                    )}
                  </td>
                  <td className="py-5 pr-3 align-top">
                    {isDraft ? (
                      <select value={l.unit} onChange={(e) => update(l._key, { unit: e.target.value })}
                        className={`${INPUT} px-2`}>
                        {SELL_UNITS.map((u) => <option key={u} value={u}>{UNIT_SHORT[u]}</option>)}
                      </select>
                    ) : (
                      <span className="text-[13.5px] text-text-dim mt-1 block">
                        {UNIT_SHORT[l.unit] ?? l.unit}
                      </span>
                    )}
                  </td>
                  <td className="py-5 pr-3 align-top">
                    {isDraft ? (
                      <input type="number" min="0" step="any" value={l.rate}
                        onChange={(e) => update(l._key, { rate: e.target.value })}
                        className={`${INPUT} text-right`} />
                    ) : (
                      <span className="tabular block text-right text-[14px] mt-1">₹{l.rate}</span>
                    )}
                  </td>
                  <td className="py-5 pr-3 align-top">
                    {isDraft ? (
                      <input type="number" min="0" max="28" step="0.5" value={l.gstRate}
                        onChange={(e) => update(l._key, { gstRate: e.target.value })}
                        className={`${INPUT} text-right`} />
                    ) : (
                      <span className="tabular block text-right text-[14px] mt-1">{l.gstRate}%</span>
                    )}
                  </td>
                  <td className="py-5 pr-3 align-top">
                    {isDraft ? (
                      <input type="number" min="0" max="100" step="any" value={l.discountPct}
                        onChange={(e) => update(l._key, { discountPct: e.target.value })}
                        className={`${INPUT} text-right`} />
                    ) : (
                      <span className="tabular block text-right text-[14px] mt-1">{l.discountPct}%</span>
                    )}
                  </td>
                  <td className="py-5 align-top text-right">
                    <span className="tabular font-semibold text-[15px] text-text mt-1 block">
                      {fmtRupee(amount)}
                    </span>
                  </td>
                  {isDraft && (
                    <td className="py-5 align-top pl-2">
                      <button
                        type="button"
                        onClick={() => removeLine(l._key)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 h-8 w-8 flex items-center justify-center rounded-[6px] text-text-dim hover:text-fault hover:bg-fault/10"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {isDraft && (
          <button
            type="button"
            onClick={addLine}
            className="mt-5 flex items-center gap-2 h-10 px-5 rounded-[8px] text-[13px] text-text-dim hover:text-accent border border-dashed border-rule hover:border-accent transition-colors"
          >
            <Plus size={14} strokeWidth={2} />
            Add line
          </button>
        )}
      </div>

      {/* ── Tax & Details ─────────────────────────────────────────────── */}
      <TaxDetails
        posCode={posCode}
        setPosCode={setPosCode}
        isIntraState={isIntraState}
        isDraft={isDraft}
      />

      {/* ── Final Total ───────────────────────────────────────────────── */}
      <div className="border-t border-rule bg-surface px-7 py-6">
        <div className="flex justify-end">
          <div className="space-y-3.5 min-w-[280px]">
            <TRow k="Taxable amount" v={totals.taxable} />
            {isIntraState ? (
              <>
                <TRow k="CGST" v={totals.cgst} />
                <TRow k="SGST" v={totals.sgst} />
              </>
            ) : (
              <TRow k="IGST" v={totals.igst} />
            )}
            {Math.abs(totals.roundOff) > 0.004 && (
              <TRow k="Round-off" v={totals.roundOff} />
            )}
            <div className="pt-4 border-t-2 border-rule flex justify-between items-baseline gap-8">
              <span className="font-semibold text-[14px] text-text">Final Total (including GST)</span>
              <span className="font-display text-[32px] font-semibold text-text tabular">
                {fmtRupee(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
