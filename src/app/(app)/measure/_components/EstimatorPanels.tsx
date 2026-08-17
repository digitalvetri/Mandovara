"use client";

import { useMemo, useState } from "react";
// The kernel is the ONLY material-maths module (§15.2). This panel used to
// call a second, divergent copy under /lib/calc which disagreed with the
// engine that actually persists CalcResult and prices the quotation.
import {
  calcCurtain, calcWallpaper, calcFlooring,
  type PatternMatch, type LayPattern,
} from "@/kernel/calc";
import {
  TwoColumn, NumField, SelectField, CheckField,
  HeroNumber, StatRow, Stat, Warnings, ErrorBanner, fmt,
} from "./EstimatorAtoms";

export function WallpaperPanel() {
  const [wallWidth,  setWallWidth]  = useState(4000);
  const [wallHeight, setWallHeight] = useState(2700);
  const [rollWidth,  setRollWidth]  = useState(530);
  const [rollLength, setRollLength] = useState(10.05);
  const [match,      setMatch]      = useState<PatternMatch>("FREE");
  const [repeat,     setRepeat]     = useState(0);
  const [wastage,    setWastage]    = useState(10);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: calcWallpaper({
          wallWidthMm:     wallWidth,
          wallHeightMm:    wallHeight,
          rollWidthMm:     rollWidth,
          rollLengthM:     rollLength,
          patternMatch:    match,
          patternRepeatMm: match === "FREE" ? 0 : repeat,
          wastagePct:      wastage,
          deductions:      [],
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [wallWidth, wallHeight, rollWidth, rollLength, match, repeat, wastage]);

  return (
    <TwoColumn
      form={
        <>
          <NumField label="Wall width (mm)"  value={wallWidth}  onChange={setWallWidth}  />
          <NumField label="Wall height (mm)" value={wallHeight} onChange={setWallHeight} />
          <NumField label="Roll width (mm)"  value={rollWidth}  onChange={setRollWidth}  />
          <NumField label="Roll length (m)"  value={rollLength} onChange={setRollLength} step={0.05} />
          <SelectField
            label="Pattern match"
            value={match}
            onChange={(v) => setMatch(v as PatternMatch)}
            options={[
              { value: "FREE",     label: "Free (no repeat)" },
              { value: "STRAIGHT", label: "Straight repeat" },
              { value: "OFFSET",   label: "Offset (half-drop)" },
            ]}
          />
          {match !== "FREE" && (
            <NumField label="Pattern repeat (mm)" value={repeat} onChange={setRepeat} />
          )}
          <NumField label="Wastage (%)" value={wastage} onChange={setWastage} />
        </>
      }
      result={
        result.ok ? (
          <>
            <HeroNumber label="Rolls required" value={result.value.rollsRequired} unit="rolls" />
            <StatRow>
              <Stat label="Cut length"    value={fmt(result.value.cutLengthMm)}  unit="mm" />
              <Stat label="Strips / roll" value={result.value.stripsPerRoll} />
              <Stat label="Strips needed" value={result.value.stripsNeeded} />
            </StatRow>
            <Warnings warnings={result.value.warnings} version={result.value.engineVersion} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}

export function FlooringPanel() {
  const [roomLength, setRoomLength] = useState(4000);
  const [roomWidth,  setRoomWidth]  = useState(3500);
  const [lay,        setLay]        = useState<LayPattern>("STRAIGHT");
  const [kind,       setKind]       = useState<"BOX" | "ROLL">("BOX");
  const [sqftPerBox, setSqftPerBox] = useState(2.2);
  const [rollWidth,  setRollWidth]  = useState(1220);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: calcFlooring({
          roomLengthMm:   roomLength,
          roomWidthMm:    roomWidth,
          layPattern:     lay,
          areaPerBoxSqft: sqftPerBox,
          ...(kind === "ROLL" && { rollWidthMm: rollWidth }),
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [roomLength, roomWidth, lay, kind, sqftPerBox, rollWidth]);

  return (
    <TwoColumn
      form={
        <>
          <NumField label="Room length (mm)" value={roomLength} onChange={setRoomLength} />
          <NumField label="Room width (mm)"  value={roomWidth}  onChange={setRoomWidth}  />
          <SelectField
            label="Lay pattern"
            value={lay}
            onChange={(v) => setLay(v as LayPattern)}
            options={[
              { value: "STRAIGHT",    label: "Straight (7% wastage)" },
              { value: "DIAGONAL",    label: "Diagonal (10% wastage)" },
              { value: "HERRINGBONE", label: "Herringbone (15% wastage)" },
            ]}
          />
          <SelectField
            label="Product kind"
            value={kind}
            onChange={(v) => setKind(v as "BOX" | "ROLL")}
            options={[
              { value: "BOX",  label: "Box-packed (planks / tiles)" },
              { value: "ROLL", label: "Roll film (vinyl / SPC roll)" },
            ]}
          />
          {kind === "BOX" ? (
            <NumField label="Area per box (sqft)" value={sqftPerBox} onChange={setSqftPerBox} step={0.1} />
          ) : (
            <NumField label="Roll width (mm)" value={rollWidth} onChange={setRollWidth} />
          )}
        </>
      }
      result={
        result.ok ? (
          <>
            {result.value.rollLengthM != null ? (
              <HeroNumber label="Roll length" value={result.value.rollLengthM} unit="m" decimals={2} />
            ) : (
              <HeroNumber label="Boxes required" value={result.value.boxesRequired} unit="boxes" />
            )}
            <StatRow>
              <Stat label="Area"         value={result.value.areaSqft.toFixed(1)}         unit="sqft" />
              <Stat label="With wastage" value={result.value.areaWithWastage.toFixed(1)}  unit="sqft" />
              <Stat label="Wastage"      value={result.value.wastagePct}                  unit="%" />
              {result.value.skirtingRft != null && (
                <Stat label="Skirting" value={result.value.skirtingRft.toFixed(2)} unit="rft" />
              )}
              {result.value.seamCount != null && (
                <Stat label="Seams" value={result.value.seamCount} />
              )}
            </StatRow>
            <Warnings warnings={result.value.warnings} version={result.value.engineVersion} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}

export function CurtainPanel() {
  const [winWidth,     setWinWidth]     = useState(1800);
  const [winHeight,    setWinHeight]    = useState(2100);
  const [fullness,     setFullness]     = useState(2.5);
  const [fabricWidth,  setFabricWidth]  = useState(1100);
  const [match,        setMatch]        = useState<PatternMatch>("FREE");
  const [repeat,       setRepeat]       = useState(0);
  const [railroadable, setRailroadable] = useState(false);
  const [railWidth,    setRailWidth]    = useState(2800);
  const [eyelet,       setEyelet]       = useState(false);
  const [lining,       setLining]       = useState(false);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: calcCurtain({
          windowWidthMm:   winWidth,
          windowHeightMm:  winHeight,
          quantity:        1,
          fullness,
          headingType:     eyelet ? "EYELET" : "PINCH_PLEAT",
          fabricWidthMm:   fabricWidth,
          patternMatch:    match,
          patternRepeatMm: match === "FREE" ? 0 : repeat,
          railroadable,
          ...(railroadable && { railroadedFabricWidthMm: railWidth }),
          ...(lining       && { liningRequired: true }),
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [winWidth, winHeight, fullness, fabricWidth, match, repeat, railroadable, railWidth, eyelet, lining]);

  return (
    <TwoColumn
      form={
        <>
          <NumField label="Window width (mm)"  value={winWidth}    onChange={setWinWidth}    />
          <NumField label="Window height (mm)" value={winHeight}   onChange={setWinHeight}   />
          <NumField label="Fullness"           value={fullness}    onChange={setFullness}    step={0.1} />
          <NumField label="Fabric width (mm)"  value={fabricWidth} onChange={setFabricWidth} />
          <SelectField
            label="Pattern match"
            value={match}
            onChange={(v) => setMatch(v as PatternMatch)}
            options={[
              { value: "FREE",     label: "Free (no repeat)" },
              { value: "STRAIGHT", label: "Straight repeat" },
              { value: "OFFSET",   label: "Offset (half-drop)" },
            ]}
          />
          {match !== "FREE" && (
            <NumField label="Pattern repeat (mm)" value={repeat} onChange={setRepeat} />
          )}
          <CheckField label="Fabric is railroadable (wide bolt available)" checked={railroadable} onChange={setRailroadable} />
          {railroadable && (
            <NumField label="Wide-bolt width (mm)" value={railWidth} onChange={setRailWidth} />
          )}
          <CheckField label="Eyelet heading" checked={eyelet} onChange={setEyelet} />
          <CheckField label="With lining"    checked={lining} onChange={setLining} />
        </>
      }
      result={
        result.ok ? (
          <>
            <HeroNumber label="Fabric required" value={result.value.materialQty.toFixed(2)} unit="m" />
            <StatRow>
              <Stat label="Run" value={result.value.fabricRun === "RAILROADED" ? "Railroaded" : "Vertical"} />
              <Stat label="Widths" value={result.value.widthsRequired} />
              <Stat label="Cut length" value={fmt(result.value.cutLengthMm)} unit="mm" />
              {result.value.liningQty != null && (
                <Stat label="Lining" value={result.value.liningQty.toFixed(2)} unit="m" />
              )}
              {result.value.eyeletCount != null && (
                <Stat label="Eyelets / panel" value={result.value.eyeletCount} />
              )}
            </StatRow>
            <Warnings warnings={result.value.warnings} version={result.value.engineVersion} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}
