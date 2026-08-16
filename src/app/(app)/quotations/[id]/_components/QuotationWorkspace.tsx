"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, MapPin, FileText } from "lucide-react";
import { updateQuotationLines } from "@/modules/quotations/actions";
import type { EditLine } from "./QuotePreviewA4";
import type { SerializedQuotation } from "../_types";
import {
  SELL_UNITS, UNIT_SHORT, newKey, INPUT, INPUT_SM,
  fmtRupee, lineAmt, computeTotals, initLines,
  stateLabel, rupeesToWords,
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
  const [saved, setSaved]     = useState(false);

  const isDraft     = ["DRAFT", "REVISED"].includes(quotation.status);
  const isIntraState = posCode === quotation.supplierStateCode;
  const totals      = computeTotals(lines, isIntraState);
  const totalRupees = Math.round(totals.total);

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
        <div className="text-[14px] font-semibold text-text">Items in this quotation</div>
        {isDraft && (
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[8px] text-[13px] font-medium transition-colors shrink-0"
            style={{ background: "oklch(0.72 0.115 85)", color: "#0B1020" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.83 0.105 85)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "oklch(0.72 0.115 85)"; }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Add Item
          </button>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="px-7 pt-6 pb-2 overflow-x-auto">
        <table className="w-full text-[13.5px] border-collapse" style={{ minWidth: "780px" }}>
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.1em] text-text-dim border-b-2 border-rule">
              <th className="text-left pb-3 pr-3 w-[44px]">#</th>
              <th className="text-left pb-3 pr-4">Item / Room</th>
              <th className="text-right pb-3 pr-3 w-[80px]">Quantity</th>
              <th className="text-left pb-3 pr-3 w-[80px]">Unit</th>
              <th className="text-right pb-3 pr-3 w-[116px]">Rate (₹)</th>
              <th className="text-right pb-3 pr-3 w-[64px]">GST %</th>
              <th className="text-right pb-3 pr-3 w-[84px]">Discount %</th>
              <th className="text-right pb-3 w-[116px]">Amount (₹)</th>
              {isDraft && <th className="w-[40px]" />}
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
                    <div className="flex items-start gap-3">
                      {/* swatch chip — neutral placeholder; colourway hex not in serialized line */}
                      <span className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-[6px] bg-surface-2 border border-rule" />
                      <div className="flex-1 min-w-0">
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
                      </div>
                    </div>
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
      </div>

      {/* ── Table footer: item count (left) + save (right) ────────────── */}
      <div className="flex items-center justify-between gap-4 px-7 py-3 border-t border-rule/50">
        <div className="text-[12.5px] text-text-dim">
          {lines.length} item{lines.length !== 1 ? "s" : ""}
        </div>
        {isDraft && (
          <div className="flex items-center gap-2.5">
            {saveErr && (
              <span className="text-[12.5px] text-fault max-w-[220px] truncate">{saveErr}</span>
            )}
            {saved && !saving && !saveErr && (
              <span className="text-[12.5px] text-solid">Saved ✓</span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-[9px] text-[13px] font-medium transition-colors disabled:opacity-60 border border-rule text-text-dim hover:text-text hover:border-accent"
            >
              <Save size={13} strokeWidth={2.2} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom: Tax & Details (left) | Final Total (right) ────────── */}
      <div className="border-t border-rule grid grid-cols-1 md:grid-cols-2">

        {/* Tax & Details ──────────────────────────────────────────────── */}
        <div className="px-7 py-6 border-b md:border-b-0 md:border-r border-rule">
          <div className="text-[11.5px] uppercase tracking-[0.1em] text-text-dim mb-4">
            Tax &amp; Details
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[13px]">
              <MapPin size={14} strokeWidth={1.75} className="text-text-dim shrink-0" />
              <span className="text-text-dim">Place of Supply:</span>
              {isDraft ? (
                <div className="flex items-center gap-2 ml-1">
                  <input
                    type="text"
                    maxLength={2}
                    value={posCode}
                    onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                    className="h-7 w-10 px-1.5 rounded-[5px] border border-rule bg-transparent text-[12px] tabular text-text text-center outline-none focus:border-accent"
                  />
                  <span className="text-text">{stateLabel(posCode)}</span>
                </div>
              ) : (
                <span className="text-text ml-1">{stateLabel(posCode)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <FileText size={14} strokeWidth={1.75} className="text-text-dim shrink-0" />
              <span className="text-text-dim">Tax Type:</span>
              <span className="text-text ml-1">
                {isIntraState ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"}
              </span>
            </div>
          </div>
        </div>

        {/* Final Total ────────────────────────────────────────────────── */}
        <div className="px-7 py-6 relative overflow-hidden">
          <div className="text-[11px] uppercase tracking-[0.12em] text-text-dim mb-3">
            Final Total (incl. GST)
          </div>
          <div className="font-display text-[38px] font-semibold text-text tabular leading-none mb-2">
            {fmtRupee(totals.total)}
          </div>
          <div className="text-[12.5px] text-text-dim leading-relaxed pr-16">
            {rupeesToWords(totalRupees)}
          </div>
          <span
            className="absolute right-4 bottom-0 text-[96px] font-bold leading-none select-none pointer-events-none"
            style={{ color: "oklch(0.72 0.115 85)", opacity: 0.06 }}
            aria-hidden
          >
            ₹
          </span>
        </div>
      </div>
    </div>
  );
}
