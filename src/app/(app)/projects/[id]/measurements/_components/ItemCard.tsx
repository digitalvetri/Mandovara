"use client";

// One MeasurementItem, rendered in the shape spec §5.2 mocked. The
// left rule + swatch and the material block on the right are the two
// signature elements the spec calls for. Warnings render in plain
// English underneath, written for a client to read.

import { useTransition } from "react";
import { Camera, Trash2, PencilLine } from "lucide-react";
import type { ItemDetail } from "@/modules/measurement/queries";
import { deleteMeasurementItem } from "@/modules/measurement/actions-item";

interface ItemCardProps {
  item:      ItemDetail;
  editable:  boolean;
}

export function ItemCard({ item, editable }: ItemCardProps) {
  const [pending, start] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${item.label}"?`)) return;
    start(async () => {
      await deleteMeasurementItem({ id: item.id });
    });
  }

  return (
    <article className="grid grid-cols-[3px_1fr] gap-3 rounded-[8px] border border-rule bg-surface-2 overflow-hidden">
      <div className="bg-gold self-stretch" aria-hidden />
      <div className="grid grid-cols-[1fr_auto] gap-4 p-3">
        {/* Left: label + dimensions + intent */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[13px] font-medium text-text">{item.label}</h3>
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-text-dim">
              {item.surface}
            </span>
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.05em] text-gold-strong">
              {item.family.replace(/_/g, " ")}
            </span>
          </div>

          <div className="tabular text-[12.5px] text-text-dim mb-1">
            {formatMm(item.widthMm)} mm × {formatMm(item.heightMm)} mm
            {item.quantity > 1 && <> × <span className="text-text">{item.quantity}</span></>}
          </div>

          {(item.headingType || item.fullness || item.layPattern || item.mountType) && (
            <div className="text-[11.5px] text-text-dim mb-1">
              {[
                item.headingType && item.headingType.replace(/_/g, " ").toLowerCase(),
                item.fullness && `fullness ${item.fullness}`,
                item.layPattern && item.layPattern.toLowerCase(),
                item.mountType && `${item.mountType.toLowerCase()} mount`,
              ].filter(Boolean).join(" · ")}
            </div>
          )}

          {item.photoKeys.length > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-text-dim">
              <Camera size={10} /> {item.photoKeys.length} photo{item.photoKeys.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Right: MATERIAL block */}
        <div className="min-w-[160px] text-right border-l border-rule pl-4">
          <div className="text-[9.5px] uppercase tracking-[0.08em] text-text-faint mb-1">Material</div>
          {item.calc ? (
            <div>
              <div className="tabular text-[15px] text-text font-medium">
                {formatQty(item.calc.materialQty)} <span className="text-[11.5px] text-text-dim">{item.calc.materialUnit.toLowerCase()}</span>
              </div>
              {item.calc.widthsRequired != null && (
                <div className="text-[11px] text-text-dim tabular">
                  {item.calc.widthsRequired} panels
                  {item.calc.cutLengthMm && <> · cut {formatMm(item.calc.cutLengthMm)} mm</>}
                </div>
              )}
              {item.calc.rollsRequired != null && (
                <div className="text-[11px] text-text-dim tabular">
                  {item.calc.rollsRequired} roll{item.calc.rollsRequired > 1 ? "s" : ""}
                  {item.calc.cutLengthMm && <> · cut {formatMm(item.calc.cutLengthMm)} mm</>}
                </div>
              )}
              {item.calc.boxesRequired != null && (
                <div className="text-[11px] text-text-dim tabular">
                  {item.calc.boxesRequired} box{item.calc.boxesRequired > 1 ? "es" : ""}
                  {item.calc.areaSqft && <> · {item.calc.areaSqft} sqft</>}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11.5px] text-text-dim">Not calculated</div>
          )}
        </div>
      </div>

      {/* Warnings — full width, plain English */}
      {item.calc && item.calc.warnings.length > 0 && (
        <div className="col-span-2 border-t border-rule bg-surface-2/50 px-4 py-2">
          <ul className="space-y-1">
            {item.calc.warnings.map((w, i) => (
              <li key={i} className="text-[11px] text-heat before:mr-1.5 before:content-['⚠']">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions row — Edit/Delete only render on DRAFT rounds. */}
      <div className="col-span-2 border-t border-rule px-4 py-2 flex justify-end items-center gap-3">
        {editable && (
            <>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 text-[10.5px] text-text-faint opacity-50 cursor-not-allowed"
                title="Inline editing lands in the field PWA (next session)"
              >
                <PencilLine size={10} /> Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="inline-flex items-center gap-1 text-[10.5px] text-fault hover:text-fault-strong disabled:opacity-60"
              >
                <Trash2 size={10} /> Delete
              </button>
            </>
          )}
        </div>
    </article>
  );
}

function formatMm(v: string): string {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatQty(v: string): string {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
