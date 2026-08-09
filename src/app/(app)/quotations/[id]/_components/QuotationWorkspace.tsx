"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, FileText, Download } from "lucide-react";
import { StatusPill } from "../../_components/StatusPill";
import { StatusChanger } from "../../_components/StatusChanger";
import { updateQuotationLines } from "@/modules/quotations/actions";
import { QuotePreviewA4, type EditLine, type PreviewTotals } from "./QuotePreviewA4";
import type { SerializedQuotation } from "../_types";

const SELL_UNITS = ["METRE", "ROLL", "SQFT", "SQM", "PIECE", "SET", "BOX", "RUNNING_FT"] as const;
const UNIT_SHORT: Record<string, string> = {
  METRE: "m", ROLL: "roll", SQFT: "sqft", SQM: "sqm",
  PIECE: "pc", SET: "set", BOX: "box", RUNNING_FT: "rft",
};

let _keyN = 0;
const newKey = () => `k-${++_keyN}`;

function paiseToRupees(p: string): string {
  try {
    const n = BigInt(p);
    const r = n / 100n;
    const f = n % 100n;
    if (f === 0n) return r.toString();
    return `${r}.${f.toString().padStart(2, "0")}`;
  } catch { return "0"; }
}

function fmtRupee(n: number): string {
  if (!isFinite(n)) return "₹0";
  const neg = n < 0;
  const abs = Math.round(Math.abs(n));
  const s = abs.toString();
  let g: string;
  if (s.length <= 3) { g = s; }
  else { const l3 = s.slice(-3); g = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + l3; }
  return neg ? `(₹${g})` : `₹${g}`;
}

function lineAmt(l: EditLine): { taxable: number; amount: number } {
  const qty = parseFloat(l.quantity) || 0;
  const rate = parseFloat(l.rate) || 0;
  const disc = parseFloat(l.discountPct) || 0;
  const gst = parseFloat(l.gstRate) || 0;
  const taxable = qty * rate * (1 - disc / 100);
  return { taxable, amount: taxable * (1 + gst / 100) };
}

function computeTotals(lines: EditLine[], isIntraState: boolean): PreviewTotals {
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

function initLines(sLines: SerializedQuotation["lines"]): EditLine[] {
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

const INPUT = "w-full h-7 px-2 rounded-[5px] bg-ink/30 border border-rule text-text text-[12px] tabular outline-none focus:border-[#2BA89A] transition-colors";
const INPUT_SM = `${INPUT} text-[11px]`;

export function QuotationWorkspace({
  quotation,
  canApprove,
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
    <div
      className="flex -mx-4 sm:-mx-6 md:-mx-8 xl:-mx-10 border-t border-rule"
      style={{ height: "calc(100svh - 90px)", overflow: "hidden" }}
    >
      {/* ── LEFT: Line editor ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">

        {/* Status strip */}
        <div className="flex items-center justify-between gap-3 px-5 h-11 border-b border-rule bg-surface shrink-0">
          <div className="flex items-center gap-2.5">
            <StatusPill status={quotation.status} />
            {quotation.revision > 0 && <span className="text-[11px] text-text-dim tabular">R{quotation.revision}</span>}
            <span className="text-[11px] text-text-dim hidden sm:inline">
              · <span className="tabular">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saveErr && <span className="text-[11px] text-fault truncate max-w-[180px]">{saveErr}</span>}
            {saved && !saving && !saveErr && <span className="text-[11px] text-solid">Saved ✓</span>}
            {isDraft && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 h-[30px] px-3 rounded-[7px] text-[12px] font-medium text-white transition-colors disabled:opacity-60"
                style={{ background: saving ? "#5A9A95" : "linear-gradient(135deg, #2BA89A 0%, #1A8A7E 100%)" }}
              >
                <Save size={12} strokeWidth={2.2} />
                {saving ? "Saving…" : "Save Lines"}
              </button>
            )}
            <StatusChanger id={quotation.id} current={quotation.status} canApprove={canApprove} />
          </div>
        </div>

        {/* Scrollable lines area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto px-5 pt-4 pb-2">
          <table className="w-full text-[12px] border-collapse" style={{ minWidth: "680px" }}>
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.11em] text-text-dim border-b border-rule">
                <th className="text-left pb-2 pr-2 w-[30px]">#</th>
                <th className="text-left pb-2 pr-2">Description / Room</th>
                <th className="text-right pb-2 pr-2 w-[68px]">Qty</th>
                <th className="text-left pb-2 pr-2 w-[76px]">Unit</th>
                <th className="text-right pb-2 pr-2 w-[90px]">Rate ₹</th>
                <th className="text-right pb-2 pr-2 w-[56px]">GST %</th>
                <th className="text-right pb-2 pr-2 w-[56px]">Disc %</th>
                <th className="text-right pb-2 w-[90px]">Amount</th>
                {isDraft && <th className="w-[32px]" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => {
                const { amount } = lineAmt(l);
                return (
                  <tr key={l._key} className="border-b border-rule/40 group align-top">
                    <td className="py-1.5 pr-2 pt-2">
                      <span className="tabular text-text-dim text-[11px]">{idx + 1}</span>
                    </td>
                    <td className="py-1.5 pr-2">
                      {isDraft ? (
                        <div className="space-y-1">
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
                          <div className="text-text">{l.description}</div>
                          {l.roomLabel && <div className="text-[11px] text-text-dim mt-0.5">{l.roomLabel}</div>}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 pt-2">
                      {isDraft ? (
                        <input type="number" min="0" step="any" value={l.quantity}
                          onChange={(e) => update(l._key, { quantity: e.target.value })}
                          className={`${INPUT} text-right`} />
                      ) : (
                        <span className="tabular block text-right">{l.quantity}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 pt-2">
                      {isDraft ? (
                        <select value={l.unit} onChange={(e) => update(l._key, { unit: e.target.value })}
                          className={`${INPUT} px-1.5 pr-0`}>
                          {SELL_UNITS.map((u) => <option key={u} value={u}>{UNIT_SHORT[u]}</option>)}
                        </select>
                      ) : (
                        <span className="text-text-dim">{UNIT_SHORT[l.unit] ?? l.unit}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 pt-2">
                      {isDraft ? (
                        <input type="number" min="0" step="any" value={l.rate}
                          onChange={(e) => update(l._key, { rate: e.target.value })}
                          className={`${INPUT} text-right`} />
                      ) : (
                        <span className="tabular block text-right">₹{l.rate}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 pt-2">
                      {isDraft ? (
                        <input type="number" min="0" max="28" step="0.5" value={l.gstRate}
                          onChange={(e) => update(l._key, { gstRate: e.target.value })}
                          className={`${INPUT} text-right`} />
                      ) : (
                        <span className="tabular block text-right">{l.gstRate}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 pt-2">
                      {isDraft ? (
                        <input type="number" min="0" max="100" step="any" value={l.discountPct}
                          onChange={(e) => update(l._key, { discountPct: e.target.value })}
                          className={`${INPUT} text-right`} />
                      ) : (
                        <span className="tabular block text-right">{l.discountPct}</span>
                      )}
                    </td>
                    <td className="py-1.5 pt-2 text-right">
                      <span className="tabular font-medium text-text">{fmtRupee(amount)}</span>
                    </td>
                    {isDraft && (
                      <td className="py-1.5 pt-2 pl-1">
                        <button
                          type="button"
                          onClick={() => removeLine(l._key)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 flex items-center justify-center rounded-[5px] text-text-dim hover:text-fault hover:bg-fault/10"
                        >
                          <Trash2 size={12} strokeWidth={2} />
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
              className="mt-3 flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[12px] text-text-dim hover:text-[#2BA89A] border border-dashed border-rule hover:border-[#2BA89A] transition-colors"
            >
              <Plus size={13} strokeWidth={2} />
              Add line
            </button>
          )}
        </div>

        {/* Totals footer */}
        <div className="border-t border-rule bg-surface px-5 py-3 shrink-0">
          <div className="flex items-end justify-between gap-4">
            {isDraft && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-text-dim uppercase tracking-[0.1em]">Supply state</label>
                <input
                  type="text"
                  maxLength={2}
                  value={posCode}
                  onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                  className="h-6 w-10 px-1.5 rounded-[4px] border border-rule bg-transparent text-[11px] tabular text-text text-center outline-none focus:border-[#2BA89A] transition-colors"
                />
                <span className="text-[10px] text-text-dim">{isIntraState ? "· intra-state" : "· inter-state"}</span>
              </div>
            )}
            <div className="ml-auto space-y-1.5 text-[12px] min-w-[220px]">
              <TRow k="Taxable" v={totals.taxable} />
              {isIntraState ? (
                <><TRow k="CGST" v={totals.cgst} /><TRow k="SGST" v={totals.sgst} /></>
              ) : (
                <TRow k="IGST" v={totals.igst} />
              )}
              {Math.abs(totals.roundOff) > 0.004 && <TRow k="Round-off" v={totals.roundOff} />}
              <div className="pt-1.5 border-t border-rule flex justify-between items-baseline">
                <span className="font-semibold text-text text-[12px]">Grand Total</span>
                <span className="font-display text-[20px] font-semibold text-text tabular">{fmtRupee(totals.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Live HTML preview ────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col border-l border-rule shrink-0"
        style={{ width: "44%", minWidth: "380px" }}
      >
        <div className="flex items-center justify-between px-4 h-11 border-b border-rule bg-surface shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={13} strokeWidth={1.8} className="text-text-dim" />
            <span className="text-[11px] text-text-dim uppercase tracking-[0.1em]">Live Preview</span>
          </div>
          <a
            href={`/api/quotations/${quotation.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-[6px] text-[11.5px] font-medium border transition-colors"
            style={{ color: "#2BA89A", borderColor: "rgba(43,168,154,0.3)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(43,168,154,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <Download size={12} strokeWidth={2} />
            PDF
          </a>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-[#D8E0DF]">
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

function TRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between text-[11.5px]">
      <span className="text-text-dim">{k}</span>
      <span className="tabular text-text">{fmtRupee(v)}</span>
    </div>
  );
}
