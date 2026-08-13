"use client";

// Live calc block, rendered under Dims and Extras. The spec calls
// out sub-100ms updates as "the moment the product earns its price"
// — we memoize on the mm-normalised input tuple so React doesn't
// recompute when the display unit or an unrelated field changes.

import { useMemo } from "react";
import { computeCalcResult, type CalcResultRow } from "@/modules/measurement/engine";
import type { ItemDraft, Unit } from "../types";
import { toMm } from "../unit-convert";

interface LiveCalcProps {
  draft: ItemDraft;
  unit:  Unit;
}

const CURTAIN_FAMILIES = new Set(["CURTAIN_FABRIC", "SHEER"]);

export function LiveCalc({ draft, unit }: LiveCalcProps) {
  const result: CalcResultRow | null = useMemo(() => {
    const w = toMm(draft.widthMm, unit);
    const h = toMm(draft.heightMm, unit);
    if (!w || !h) return null;
    const q = parseInt(draft.quantity, 10) || 1;
    try {
      const input: Parameters<typeof computeCalcResult>[0] = {
        family:   draft.family,
        widthMm:  w,
        heightMm: h,
        quantity: q,
      };
      if (draft.headingType) input.headingType = draft.headingType;
      if (draft.fullness)    input.fullness    = parseFloat(draft.fullness);
      if (draft.layPattern)  input.layPattern  = draft.layPattern;
      if (draft.mountType)   input.mountType   = draft.mountType;
      if (draft.family === "WALLPAPER") input.deductions = [];
      if (CURTAIN_FAMILIES.has(draft.family) && !draft.headingType) {
        input.headingType = "EYELET";
        input.fullness = input.fullness ?? 2.5;
      }
      return computeCalcResult(input);
    } catch {
      return null;
    }
  }, [
    draft.widthMm, draft.heightMm, draft.quantity, draft.family, unit,
    draft.headingType, draft.fullness, draft.layPattern, draft.mountType,
  ]);

  if (!result) {
    return (
      <div className="mt-4 rounded-[10px] border border-dashed border-rule bg-surface/50 px-4 py-3 text-[12px] text-text-dim">
        Enter width and height to see the material estimate.
      </div>
    );
  }

  const provisional = result.warnings.filter((w) => !/provisional/i.test(w));
  return (
    <div className="mt-4 rounded-[10px] border border-rule bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-text-faint">Material</div>
        <div className="text-[10.5px] text-text-faint tabular">{result.engineVersion}</div>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="tabular text-[26px] leading-none font-medium text-gold-strong">
          {formatQty(result.materialQty)}
        </div>
        <div className="text-[13px] text-text-dim">{result.materialUnit.toLowerCase()}</div>
      </div>
      <div className="mt-1 text-[11.5px] text-text-dim tabular">
        {sublineFor(result)}
      </div>
      {provisional.length > 0 && (
        <ul className="mt-2 space-y-1">
          {provisional.map((w, i) => (
            <li key={i} className="text-[11.5px] text-heat before:mr-1.5 before:content-['⚠']">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function sublineFor(r: CalcResultRow): string {
  const bits: string[] = [];
  if (r.widthsRequired) bits.push(`${r.widthsRequired} panel${r.widthsRequired === 1 ? "" : "s"}`);
  if (r.rollsRequired)  bits.push(`${r.rollsRequired} roll${r.rollsRequired === 1 ? "" : "s"}`);
  if (r.boxesRequired)  bits.push(`${r.boxesRequired} box${r.boxesRequired === 1 ? "" : "es"}`);
  if (r.cutLengthMm)    bits.push(`cut ${Math.round(r.cutLengthMm)} mm`);
  if (r.areaSqft)       bits.push(`${r.areaSqft.toFixed(1)} sqft`);
  return bits.join(" · ");
}

function formatQty(v: number): string {
  return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
