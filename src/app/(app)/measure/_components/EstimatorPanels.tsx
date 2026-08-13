"use client";

import { useMemo, useState } from "react";
import {
  calcWallpaper, WALLPAPER_ENGINE_VERSION,
  type PatternMatch as WallpaperPatternMatch,
} from "@/lib/calc/wallpaper";
import { calcFlooring, FLOORING_ENGINE_VERSION, type LayPattern } from "@/lib/calc/flooring";
import {
  calcCurtain, CURTAIN_ENGINE_VERSION,
  type PatternMatch as CurtainPatternMatch,
} from "@/lib/calc/curtain";
import {
  TwoColumn, NumField, SelectField, CheckField,
  HeroNumber, StatRow, Stat, Warnings, ErrorBanner, fmt,
} from "./EstimatorAtoms";

export function WallpaperPanel() {
  const [wallWidth,  setWallWidth]  = useState(4000);
  const [wallHeight, setWallHeight] = useState(2700);
  const [rollWidth,  setRollWidth]  = useState(530);
  const [rollLength, setRollLength] = useState(10.05);
  const [match,      setMatch]      = useState<WallpaperPatternMatch>("FREE");
  const [repeat,     setRepeat]     = useState(0);

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
          deductions:      [],
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [wallWidth, wallHeight, rollWidth, rollLength, match, repeat]);

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
            onChange={(v) => setMatch(v as WallpaperPatternMatch)}
            options={[
              { value: "FREE",     label: "Free (no repeat)" },
              { value: "STRAIGHT", label: "Straight repeat" },
              { value: "OFFSET",   label: "Offset (half-drop)" },
            ]}
          />
          {match !== "FREE" && (
            <NumField label="Pattern repeat (mm)" value={repeat} onChange={setRepeat} />
          )}
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
            <Warnings warnings={result.value.warnings} version={WALLPAPER_ENGINE_VERSION} />
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
          roomLengthMm: roomLength,
          roomWidthMm:  roomWidth,
          layPattern:   lay,
          product:
            kind === "BOX"
              ? { kind: "BOX",  areaPerBoxSqft: sqftPerBox }
              : { kind: "ROLL", rollWidthMm:    rollWidth  },
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
            {result.value.boxesRequired != null ? (
              <HeroNumber label="Boxes required" value={result.value.boxesRequired} unit="boxes" />
            ) : (
              <HeroNumber label="Roll length" value={result.value.rollLengthM ?? 0} unit="m" decimals={2} />
            )}
            <StatRow>
              <Stat label="Area"         value={result.value.areaSqft.toFixed(1)}            unit="sqft" />
              <Stat label="With wastage" value={result.value.areaWithWastageSqft.toFixed(1)} unit="sqft" />
              <Stat label="Wastage"      value={result.value.wastagePct}                     unit="%" />
              <Stat label="Skirting"     value={result.value.skirtingRft.toFixed(2)}         unit="rft" />
              {result.value.seamCount != null && (
                <Stat label="Seams" value={result.value.seamCount} />
              )}
            </StatRow>
            <Warnings warnings={result.value.warnings} version={FLOORING_ENGINE_VERSION} />
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
  const [match,        setMatch]        = useState<CurtainPatternMatch>("FREE");
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
          fullness,
          fabricWidthMm:   fabricWidth,
          patternMatch:    match,
          patternRepeatMm: match === "FREE" ? 0 : repeat,
          railroadable,
          ...(railroadable && { railroadedFabricWidthMm: railWidth }),
          ...(eyelet       && { headingType: "EYELET" as const }),
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
            onChange={(v) => setMatch(v as CurtainPatternMatch)}
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
            <HeroNumber label="Fabric required" value={result.value.fabricMetres.toFixed(2)} unit="m" />
            <StatRow>
              <Stat label="Run" value={result.value.fabricRun === "RAILROADED" ? "Railroaded" : "Vertical"} />
              {result.value.panels != null && (
                <Stat label="Panels" value={result.value.panels} />
              )}
              {result.value.cutLengthMm != null && (
                <Stat label="Cut length" value={fmt(result.value.cutLengthMm)} unit="mm" />
              )}
              {result.value.liningMetres != null && (
                <Stat label="Lining" value={result.value.liningMetres.toFixed(2)} unit="m" />
              )}
              {result.value.eyeletCountPerPanel != null && (
                <Stat label="Eyelets / panel" value={result.value.eyeletCountPerPanel} />
              )}
            </StatRow>
            <Warnings warnings={result.value.warnings} version={CURTAIN_ENGINE_VERSION} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}
