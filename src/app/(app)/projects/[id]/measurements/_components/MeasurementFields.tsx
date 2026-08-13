"use client";

import type { PatternMatch as WallpaperPatternMatch } from "@/lib/calc/wallpaper";
import type { LayPattern } from "@/lib/calc/flooring";
import type { PatternMatch as CurtainPatternMatch } from "@/lib/calc/curtain";
import type { WallpaperInputs, FlooringInputs, CurtainInputs } from "./measurement-types";
import { NumInput, Select, Check } from "./MeasurementAtoms";

export function WallpaperFields({
  value, onChange,
}: { value: WallpaperInputs; onChange: (v: WallpaperInputs) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumInput label="Wall width (mm)"  v={value.wallWidthMm}  set={(n) => onChange({ ...value, wallWidthMm:  n })} />
      <NumInput label="Wall height (mm)" v={value.wallHeightMm} set={(n) => onChange({ ...value, wallHeightMm: n })} />
      <NumInput label="Roll width (mm)"  v={value.rollWidthMm}  set={(n) => onChange({ ...value, rollWidthMm:  n })} />
      <NumInput label="Roll length (m)"  v={value.rollLengthM}  set={(n) => onChange({ ...value, rollLengthM:  n })} step={0.05} />
      <Select label="Pattern match" value={value.patternMatch} onChange={(pm) => onChange({ ...value, patternMatch: pm as WallpaperPatternMatch })}
        options={[
          { value: "FREE",     label: "Free" },
          { value: "STRAIGHT", label: "Straight" },
          { value: "OFFSET",   label: "Offset (half-drop)" },
        ]}
      />
      {value.patternMatch !== "FREE" && (
        <NumInput label="Repeat (mm)" v={value.patternRepeatMm} set={(n) => onChange({ ...value, patternRepeatMm: n })} />
      )}
    </div>
  );
}

export function FlooringFields({
  value, onChange,
}: { value: FlooringInputs; onChange: (v: FlooringInputs) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumInput label="Room length (mm)" v={value.roomLengthMm} set={(n) => onChange({ ...value, roomLengthMm: n })} />
      <NumInput label="Room width (mm)"  v={value.roomWidthMm}  set={(n) => onChange({ ...value, roomWidthMm:  n })} />
      <Select label="Lay pattern" value={value.layPattern} onChange={(lp) => onChange({ ...value, layPattern: lp as LayPattern })}
        options={[
          { value: "STRAIGHT",    label: "Straight (7%)" },
          { value: "DIAGONAL",    label: "Diagonal (10%)" },
          { value: "HERRINGBONE", label: "Herringbone (15%)" },
        ]}
      />
      <Select label="Product kind" value={value.productKind} onChange={(k) => onChange({ ...value, productKind: k as "BOX" | "ROLL" })}
        options={[
          { value: "BOX",  label: "Box-packed" },
          { value: "ROLL", label: "Roll film" },
        ]}
      />
      {value.productKind === "BOX" ? (
        <NumInput label="Area per box (sqft)" v={value.areaPerBoxSqft} set={(n) => onChange({ ...value, areaPerBoxSqft: n })} step={0.1} />
      ) : (
        <NumInput label="Roll width (mm)" v={value.rollWidthMm} set={(n) => onChange({ ...value, rollWidthMm: n })} />
      )}
    </div>
  );
}

export function CurtainFields({
  value, onChange,
}: { value: CurtainInputs; onChange: (v: CurtainInputs) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <NumInput label="Window width (mm)"  v={value.windowWidthMm}  set={(n) => onChange({ ...value, windowWidthMm:  n })} />
      <NumInput label="Window height (mm)" v={value.windowHeightMm} set={(n) => onChange({ ...value, windowHeightMm: n })} />
      <NumInput label="Fullness"           v={value.fullness}       set={(n) => onChange({ ...value, fullness:       n })} step={0.1} />
      <NumInput label="Fabric width (mm)"  v={value.fabricWidthMm}  set={(n) => onChange({ ...value, fabricWidthMm:  n })} />
      <Select label="Pattern match" value={value.patternMatch} onChange={(pm) => onChange({ ...value, patternMatch: pm as CurtainPatternMatch })}
        options={[
          { value: "FREE",     label: "Free" },
          { value: "STRAIGHT", label: "Straight" },
          { value: "OFFSET",   label: "Offset (half-drop)" },
        ]}
      />
      {value.patternMatch !== "FREE" && (
        <NumInput label="Repeat (mm)" v={value.patternRepeatMm} set={(n) => onChange({ ...value, patternRepeatMm: n })} />
      )}
      <Check label="Railroadable" checked={value.railroadable} onChange={(b) => onChange({ ...value, railroadable: b })} />
      {value.railroadable && (
        <NumInput label="Wide-bolt width (mm)" v={value.railroadedFabricWidthMm} set={(n) => onChange({ ...value, railroadedFabricWidthMm: n })} />
      )}
      <Check label="Eyelet heading" checked={value.eyelet} onChange={(b) => onChange({ ...value, eyelet: b })} />
      <Check label="With lining"    checked={value.lining} onChange={(b) => onChange({ ...value, lining: b })} />
    </div>
  );
}
