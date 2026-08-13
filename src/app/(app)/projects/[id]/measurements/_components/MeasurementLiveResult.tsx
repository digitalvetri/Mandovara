"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { calcWallpaper, WALLPAPER_ENGINE_VERSION } from "@/lib/calc/wallpaper";
import { calcFlooring, FLOORING_ENGINE_VERSION } from "@/lib/calc/flooring";
import { calcCurtain, CURTAIN_ENGINE_VERSION } from "@/lib/calc/curtain";
import type { Family, WallpaperInputs, FlooringInputs, CurtainInputs } from "./measurement-types";
import { Stat } from "./MeasurementAtoms";

export function LiveResult({
  family, wp, fl, ct,
}: {
  family: Family;
  wp: WallpaperInputs;
  fl: FlooringInputs;
  ct: CurtainInputs;
}) {
  const result = useMemo(() => {
    try {
      if (family === "WALLPAPER") {
        return {
          version: WALLPAPER_ENGINE_VERSION,
          ok: true as const,
          value: calcWallpaper({
            wallWidthMm:     wp.wallWidthMm,
            wallHeightMm:    wp.wallHeightMm,
            rollWidthMm:     wp.rollWidthMm,
            rollLengthM:     wp.rollLengthM,
            patternMatch:    wp.patternMatch,
            patternRepeatMm: wp.patternMatch === "FREE" ? 0 : wp.patternRepeatMm,
            deductions:      [],
          }),
        };
      }
      if (family === "FLOORING") {
        return {
          version: FLOORING_ENGINE_VERSION,
          ok: true as const,
          value: calcFlooring({
            roomLengthMm: fl.roomLengthMm,
            roomWidthMm:  fl.roomWidthMm,
            layPattern:   fl.layPattern,
            product:
              fl.productKind === "BOX"
                ? { kind: "BOX",  areaPerBoxSqft: fl.areaPerBoxSqft }
                : { kind: "ROLL", rollWidthMm:    fl.rollWidthMm },
          }),
        };
      }
      return {
        version: CURTAIN_ENGINE_VERSION,
        ok: true as const,
        value: calcCurtain({
          windowWidthMm:   ct.windowWidthMm,
          windowHeightMm:  ct.windowHeightMm,
          fullness:        ct.fullness,
          fabricWidthMm:   ct.fabricWidthMm,
          patternMatch:    ct.patternMatch,
          patternRepeatMm: ct.patternMatch === "FREE" ? 0 : ct.patternRepeatMm,
          railroadable:    ct.railroadable,
          ...(ct.railroadable && { railroadedFabricWidthMm: ct.railroadedFabricWidthMm }),
          ...(ct.eyelet       && { headingType: "EYELET" as const }),
          ...(ct.lining       && { liningRequired: true }),
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message, version: "" };
    }
  }, [family, wp, fl, ct]);

  if (!result.ok) {
    return (
      <div className="flex items-start gap-2 text-[12px] text-bad bg-bad/8 border border-bad/30 rounded-[8px] px-3 py-2">
        <AlertTriangle size={13} strokeWidth={1.75} className="mt-[3px] shrink-0" />
        <span>{result.error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {family === "WALLPAPER" && "rollsRequired" in result.value && (
          <>
            <Stat label="Rolls"       value={result.value.rollsRequired}  emphasize />
            <Stat label="Cut length"  value={result.value.cutLengthMm}    unit="mm" />
            <Stat label="Strips/roll" value={result.value.stripsPerRoll} />
            <Stat label="Strips"      value={result.value.stripsNeeded} />
          </>
        )}
        {family === "FLOORING" && "areaSqft" in result.value && (
          <>
            {result.value.boxesRequired != null ? (
              <Stat label="Boxes" value={result.value.boxesRequired} emphasize />
            ) : (
              <Stat label="Roll length" value={result.value.rollLengthM?.toFixed(2) ?? "—"} unit="m" emphasize />
            )}
            <Stat label="Area"     value={result.value.areaSqft.toFixed(1)} unit="sqft" />
            <Stat label="Wastage"  value={result.value.wastagePct}          unit="%" />
            <Stat label="Skirting" value={result.value.skirtingRft.toFixed(2)} unit="rft" />
            {result.value.seamCount != null && <Stat label="Seams" value={result.value.seamCount} />}
          </>
        )}
        {family === "CURTAIN" && "fabricMetres" in result.value && (
          <>
            <Stat label="Fabric" value={result.value.fabricMetres.toFixed(2)} unit="m" emphasize />
            <Stat label="Run"    value={result.value.fabricRun === "RAILROADED" ? "Railroaded" : "Vertical"} />
            {result.value.panels != null && <Stat label="Panels" value={result.value.panels} />}
            {result.value.cutLengthMm != null && <Stat label="Cut length" value={result.value.cutLengthMm} unit="mm" />}
            {result.value.liningMetres != null && <Stat label="Lining" value={result.value.liningMetres.toFixed(2)} unit="m" />}
            {result.value.eyeletCountPerPanel != null && <Stat label="Eyelets/panel" value={result.value.eyeletCountPerPanel} />}
          </>
        )}
      </div>

      {"warnings" in result.value && result.value.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {result.value.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[11.5px] text-text bg-accent/8 border border-accent/25 rounded-[6px] px-3 py-1.5">
              <AlertTriangle size={12} strokeWidth={1.75} className="mt-[3px] text-accent shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-faint">
        Engine · {result.version}
      </div>
    </div>
  );
}
