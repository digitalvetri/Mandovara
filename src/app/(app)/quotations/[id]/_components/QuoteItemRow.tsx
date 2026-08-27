"use client";

import { Trash2 } from "lucide-react";
import type { EditLine } from "./QuotePreviewA4";
import { SELL_UNITS, UNIT_SHORT, INPUT, INPUT_SM, INPUT_NUM, GST_SLABS, fmtRupee, lineAmt } from "./workspace-helpers";

interface Props {
  line: EditLine;
  isDraft: boolean;
  showDiscCol: boolean;
  hasColourway: boolean;
  index: number;
  onUpdate: (key: string, patch: Partial<EditLine>) => void;
  onRemove: (key: string) => void;
}

export function QuoteItemRow({
  line: l, isDraft, showDiscCol, hasColourway, index, onUpdate, onRemove,
}: Props) {
  const { amount } = lineAmt(l);

  return (
    <tr className="border-b border-rule/40 group hover:bg-ink/10 transition-colors">

      {/* # */}
      <td className="py-3 px-4 align-top">
        <span className="tabular text-text-dim text-[12px]">{index + 1}</span>
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
                  onChange={(e) => onUpdate(l._key, { description: e.target.value })}
                  className={INPUT}
                />
                <input
                  type="text"
                  value={l.roomLabel}
                  placeholder="Room / location (optional)"
                  onChange={(e) => onUpdate(l._key, { roomLabel: e.target.value })}
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
          {/* QTY — spinner-free so 4-digit values aren't clipped */}
          <td className="py-3 px-3 align-top">
            <input type="number" min="0" step="any" value={l.quantity}
              onChange={(e) => onUpdate(l._key, { quantity: e.target.value })}
              className={`${INPUT_NUM} text-right`} />
          </td>
          {/* UNIT — pr-8 leaves room for the native dropdown arrow */}
          <td className="py-3 px-3 align-top">
            <select value={l.unit} onChange={(e) => onUpdate(l._key, { unit: e.target.value })}
              className={`${INPUT} pl-2 pr-8`}>
              {SELL_UNITS.map((u) => <option key={u} value={u}>{UNIT_SHORT[u]}</option>)}
            </select>
          </td>
          {/* RATE — spinner-free */}
          <td className="py-3 px-3 align-top">
            <input type="number" min="0" step="any" value={l.rate}
              onChange={(e) => onUpdate(l._key, { rate: e.target.value })}
              className={`${INPUT_NUM} text-right`} />
          </td>
          {/* GST — fixed Indian slabs; no free-form input needed */}
          <td className="py-3 px-3 align-top">
            <select value={l.gstRate} onChange={(e) => onUpdate(l._key, { gstRate: e.target.value })}
              className={`${INPUT} pl-2 pr-8`}>
              {GST_SLABS.map((s) => (
                <option key={s} value={s}>{s}%</option>
              ))}
            </select>
          </td>
          {/* DISC — spinner-free */}
          {showDiscCol && (
            <td className="py-3 px-3 align-top">
              <input type="number" min="0" max="100" step="any" value={l.discountPct}
                onChange={(e) => onUpdate(l._key, { discountPct: e.target.value })}
                className={`${INPUT_NUM} text-right`} />
            </td>
          )}
        </>
      ) : (
        <>
          <td className="py-3 px-3 align-top text-right">
            <span className="tabular text-text">{l.quantity}</span>
            <span className="text-text-dim text-[11px] ml-1">{UNIT_SHORT[l.unit] ?? l.unit}</span>
          </td>
          <td className="py-3 px-3 align-top text-right">
            <span className="tabular text-text">{fmtRupee(parseFloat(l.rate) || 0)}</span>
            <div className="text-[10.5px] text-text-dim mt-0.5">{l.gstRate}% GST</div>
          </td>
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
            onClick={() => onRemove(l._key)}
            className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 h-8 w-8 flex items-center justify-center rounded-[6px] text-text-dim hover:text-fault hover:bg-fault/10"
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </td>
      )}
    </tr>
  );
}
