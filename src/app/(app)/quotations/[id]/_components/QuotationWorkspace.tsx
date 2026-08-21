"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { updateQuotationLines } from "@/modules/quotations/actions-status";
import type { EditLine } from "./QuotePreviewA4";
import type { SerializedQuotation } from "../_types";
import {
  SELL_UNITS, UNIT_SHORT, newKey, INPUT, INPUT_SM,
  fmtRupee, lineAmt, computeTotals, initLines,
} from "./workspace-helpers";
import { QuotationSummaryBar } from "./QuotationSummaryBar";

export function QuotationWorkspace({
  quotation,
  canApprove: _canApprove,
}: {
  quotation: SerializedQuotation;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [lines, setLines]   = useState<EditLine[]>(() => initLines(quotation.lines));
  const [posCode, setPosCode] = useState(quotation.supplierStateCode);
  const [saving, startSave] = useTransition();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved]     = useState(false);

  // colourwayId lookup for swatch strip — stripped from EditLine by initLines
  const colourwayMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const sl of quotation.lines) m.set(sl.id, sl.colourwayId);
    return m;
  }, [quotation.lines]);

  const isDraft      = ["DRAFT", "REVISED"].includes(quotation.status);
  const isIntraState = posCode === quotation.supplierStateCode;
  const totals       = computeTotals(lines, isIntraState);
  const totalRupees  = Math.round(totals.total);

  // In read-only mode, hide the Disc % column if all lines have 0 discount
  const anyDiscount  = lines.some((l) => parseFloat(l.discountPct) > 0);
  const showDiscCol  = isDraft || anyDiscount;

  function update(key: string, patch: Partial<EditLine>) {
    setLines((p) => p.map((l) => l._key === key ? { ...l, ...patch } : l));
    setSaved(false);
  }

  function addLine() {
    setLines((p) => [
      ...p,
      { _key: newKey(), description: "", roomLabel: "", quantity: "1", unit: "PIECE",
        rate: "0", gstRate: "18", discountPct: "0", isOptional: false },
    ]);
    setSaved(false);
  }

  function removeLine(key: string) {
    setLines((p) => p.filter((l) => l._key !== key));
    setSaved(false);
  }

  function handleSave() {
    const valid = lines.filter((l) => l.description.trim());
    if (!valid.length) { setSaveErr("Add at least one item with a description"); return; }
    setSaveErr(null);
    startSave(async () => {
      const res = await updateQuotationLines({
        quotationId: quotation.id,
        placeOfSupplyCode: posCode,
        lines: valid.map((l) => ({
          description: l.description.trim(),
          roomLabel:   l.roomLabel.trim() || undefined,
          quantity:    parseFloat(l.quantity) || 1,
          unit:        l.unit as typeof SELL_UNITS[number],
          rate:        l.rate,
          gstRate:     parseFloat(l.gstRate) || 0,
          discountPct: parseFloat(l.discountPct) || 0,
          isOptional:  l.isOptional,
        })),
      });
      if (!res.ok) { setSaveErr(res.error ?? "Save failed"); return; }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-[16px] bg-surface border border-rule overflow-hidden shadow-sm">

      {/* ── Section header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="text-[9.5px] uppercase tracking-[0.22em] text-text-dim font-semibold">
            Quotation Items
          </div>
          {lines.length > 0 && (
            <span className="text-[10.5px] tabular text-text-dim bg-ink/40 border border-rule px-1.5 py-0.5 rounded-[4px]">
              {lines.length}
            </span>
          )}
        </div>
        {isDraft && (
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[7px] text-[12px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 transition-colors shrink-0"
          >
            <Plus size={13} strokeWidth={2.5} />
            Add Item
          </button>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table
          className="w-full text-[13px] border-collapse"
          style={{ minWidth: isDraft ? "800px" : "560px" }}
        >
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-text-dim bg-ink/20 border-b border-rule">
              <th className="text-left py-2.5 px-4 w-[36px]">#</th>
              <th className="text-left py-2.5 px-3">Item</th>
              {isDraft && <>
                <th className="text-right py-2.5 px-3 w-[80px]">Qty</th>
                <th className="text-left py-2.5 px-3 w-[72px]">Unit</th>
                <th className="text-right py-2.5 px-3 w-[110px]">Rate (₹)</th>
                <th className="text-right py-2.5 px-3 w-[62px]">GST %</th>
                {showDiscCol && <th className="text-right py-2.5 px-3 w-[70px]">Disc %</th>}
              </>}
              {!isDraft && <>
                <th className="text-right py-2.5 px-3 w-[70px]">Qty</th>
                <th className="text-right py-2.5 px-3 w-[120px]">Rate</th>
                {showDiscCol && <th className="text-right py-2.5 px-3 w-[60px]">Disc</th>}
              </>}
              <th className="text-right py-2.5 px-4 w-[120px]">Amount (₹)</th>
              {isDraft && <th className="w-[36px]" />}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const { amount } = lineAmt(l);
              const hasColourway = !!colourwayMap.get(l._key);
              return (
                <tr
                  key={l._key}
                  className="border-b border-rule/40 group hover:bg-ink/10 transition-colors"
                >
                  {/* # */}
                  <td className="py-3 px-4 align-top">
                    <span className="tabular text-text-dim text-[12px]">{idx + 1}</span>
                  </td>

                  {/* Item & Room */}
                  <td className="py-3 px-3 align-top">
                    <div className="flex items-start gap-2.5">
                      {/* §6.1 spec: left-edge swatch strip on every quote line */}
                      <span
                        className={`flex-shrink-0 self-stretch w-[3px] rounded-full min-h-[18px] mt-0.5 ${
                          hasColourway ? "bg-accent/60" : "bg-rule"
                        }`}
                        aria-hidden
                      />
                      <div className="flex-1 min-w-0">
                        {isDraft ? (
                          <div className="space-y-2">
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
                              placeholder="Room / location (optional)"
                              onChange={(e) => update(l._key, { roomLabel: e.target.value })}
                              className={INPUT_SM}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="text-[14px] font-medium text-text leading-snug">
                              {l.description}
                            </div>
                            {l.roomLabel && (
                              <div className="text-[11.5px] text-text-dim mt-1">{l.roomLabel}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {isDraft ? (
                    <>
                      {/* Qty */}
                      <td className="py-3 px-3 align-top">
                        <input type="number" min="0" step="any" value={l.quantity}
                          onChange={(e) => update(l._key, { quantity: e.target.value })}
                          className={`${INPUT} text-right`} />
                      </td>
                      {/* Unit */}
                      <td className="py-3 px-3 align-top">
                        <select value={l.unit} onChange={(e) => update(l._key, { unit: e.target.value })}
                          className={`${INPUT} px-2`}>
                          {SELL_UNITS.map((u) => <option key={u} value={u}>{UNIT_SHORT[u]}</option>)}
                        </select>
                      </td>
                      {/* Rate */}
                      <td className="py-3 px-3 align-top">
                        <input type="number" min="0" step="any" value={l.rate}
                          onChange={(e) => update(l._key, { rate: e.target.value })}
                          className={`${INPUT} text-right`} />
                      </td>
                      {/* GST % */}
                      <td className="py-3 px-3 align-top">
                        <input type="number" min="0" max="28" step="0.5" value={l.gstRate}
                          onChange={(e) => update(l._key, { gstRate: e.target.value })}
                          className={`${INPUT} text-right`} />
                      </td>
                      {/* Disc % */}
                      {showDiscCol && (
                        <td className="py-3 px-3 align-top">
                          <input type="number" min="0" max="100" step="any" value={l.discountPct}
                            onChange={(e) => update(l._key, { discountPct: e.target.value })}
                            className={`${INPUT} text-right`} />
                        </td>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Qty + Unit combined */}
                      <td className="py-3 px-3 align-top text-right">
                        <span className="tabular text-text">{l.quantity}</span>
                        <span className="text-text-dim text-[11px] ml-1">{UNIT_SHORT[l.unit] ?? l.unit}</span>
                      </td>
                      {/* Rate with GST note */}
                      <td className="py-3 px-3 align-top text-right">
                        <span className="tabular text-text">{fmtRupee(parseFloat(l.rate) || 0)}</span>
                        <div className="text-[10.5px] text-text-dim mt-0.5">
                          {l.gstRate}% GST
                        </div>
                      </td>
                      {/* Disc % (only if any line has it) */}
                      {showDiscCol && (
                        <td className="py-3 px-3 align-top text-right">
                          <span className="tabular text-text-dim text-[12.5px]">
                            {parseFloat(l.discountPct) > 0 ? `${l.discountPct}%` : "—"}
                          </span>
                        </td>
                      )}
                    </>
                  )}

                  {/* Amount */}
                  <td className="py-3 px-4 align-top text-right">
                    <span className="tabular font-semibold text-[15px] text-text">
                      {fmtRupee(amount)}
                    </span>
                  </td>

                  {/* Delete (draft only) */}
                  {isDraft && (
                    <td className="py-3 align-top pl-1">
                      <button
                        type="button"
                        onClick={() => removeLine(l._key)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 h-8 w-8 flex items-center justify-center rounded-[6px] text-text-dim hover:text-fault hover:bg-fault/10"
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}

            {lines.length === 0 && (
              <tr>
                <td colSpan={isDraft ? (showDiscCol ? 9 : 8) : (showDiscCol ? 6 : 5)}
                  className="py-12 text-center text-[13px] text-text-dim">
                  No items yet.{isDraft && " Click “Add Item” to start."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Draft footer: Save ──────────────────────────────────────── */}
      {isDraft && (
        <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-t border-rule/60 bg-ink/10">
          <div className="text-[12px] text-text-dim">
            {lines.length} item{lines.length !== 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-2.5">
            {saveErr && <span className="text-[12px] text-fault max-w-[220px] truncate">{saveErr}</span>}
            {saved && !saving && !saveErr && <span className="text-[12px] text-solid">Saved ✓</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 h-8 px-4 rounded-[7px] text-[12.5px] font-semibold bg-accent text-ink hover:bg-accent/85 disabled:opacity-60 transition-colors"
            >
              <Save size={13} strokeWidth={2.2} />
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      <QuotationSummaryBar
        isDraft={isDraft}
        isIntraState={isIntraState}
        posCode={posCode}
        onPosCodeChange={setPosCode}
        totals={totals}
        totalRupees={totalRupees}
      />
    </div>
  );
}
