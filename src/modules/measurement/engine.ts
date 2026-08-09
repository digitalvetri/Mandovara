// The one place that maps a MeasurementFamily to its calc engine.
// Server actions call runEngine() to compute + serialise CalcResult
// rows; the client uses the underlying /lib/calc functions directly
// for live-typing feedback.  Both paths share the same code.

import {
  calcWallpaper, WALLPAPER_ENGINE_VERSION,
} from "@/lib/calc/wallpaper";
import {
  calcFlooring, FLOORING_ENGINE_VERSION,
} from "@/lib/calc/flooring";
import {
  calcCurtain, CURTAIN_ENGINE_VERSION,
} from "@/lib/calc/curtain";
import type {
  CreateMeasurementInput,
  WallpaperInput, FlooringInput, CurtainInput,
} from "./schema";

export interface EngineOutput {
  engineVersion: string;
  outputs:       Record<string, unknown>;
  warnings:      string[];
}

export function runEngine(input: CreateMeasurementInput): EngineOutput {
  switch (input.family) {
    case "WALLPAPER": return runWallpaper(input.inputs);
    case "FLOORING":  return runFlooring(input.inputs);
    case "CURTAIN":   return runCurtain(input.inputs);
  }
}

function runWallpaper(i: WallpaperInput): EngineOutput {
  const r = calcWallpaper({
    wallWidthMm:     i.wallWidthMm,
    wallHeightMm:    i.wallHeightMm,
    rollWidthMm:     i.rollWidthMm,
    rollLengthM:     i.rollLengthM,
    patternMatch:    i.patternMatch,
    patternRepeatMm: i.patternRepeatMm,
    deductions:      [],
  });
  return {
    engineVersion: WALLPAPER_ENGINE_VERSION,
    outputs: {
      cutLengthMm:         r.cutLengthMm,
      stripsPerRoll:       r.stripsPerRoll,
      stripsNeeded:        r.stripsNeeded,
      rollsRequired:       r.rollsRequired,
      patternMatchApplied: r.patternMatchApplied,
    },
    warnings: r.warnings,
  };
}

function runFlooring(i: FlooringInput): EngineOutput {
  const r = calcFlooring({
    roomLengthMm: i.roomLengthMm,
    roomWidthMm:  i.roomWidthMm,
    layPattern:   i.layPattern,
    product: i.productKind === "BOX"
      ? { kind: "BOX",  areaPerBoxSqft: i.areaPerBoxSqft }
      : { kind: "ROLL", rollWidthMm:    i.rollWidthMm    },
  });
  return {
    engineVersion: FLOORING_ENGINE_VERSION,
    outputs: {
      areaSqft:             r.areaSqft,
      wastagePct:           r.wastagePct,
      areaWithWastageSqft:  r.areaWithWastageSqft,
      skirtingRft:          r.skirtingRft,
      ...(r.boxesRequired  != null && { boxesRequired:  r.boxesRequired  }),
      ...(r.stripsRequired != null && { stripsRequired: r.stripsRequired }),
      ...(r.rollLengthM    != null && { rollLengthM:    r.rollLengthM    }),
      ...(r.seamCount      != null && { seamCount:      r.seamCount      }),
    },
    warnings: r.warnings,
  };
}

function runCurtain(i: CurtainInput): EngineOutput {
  const r = calcCurtain({
    windowWidthMm:            i.windowWidthMm,
    windowHeightMm:           i.windowHeightMm,
    fullness:                 i.fullness,
    fabricWidthMm:            i.fabricWidthMm,
    patternMatch:             i.patternMatch,
    patternRepeatMm:          i.patternRepeatMm,
    railroadable:             i.railroadable,
    ...(i.railroadable && { railroadedFabricWidthMm: i.railroadedFabricWidthMm }),
    ...(i.eyelet && { headingType: "EYELET" as const }),
    liningRequired:           i.lining,
  });
  return {
    engineVersion: CURTAIN_ENGINE_VERSION,
    outputs: {
      fabricRun:    r.fabricRun,
      fabricMetres: r.fabricMetres,
      ...(r.panels              != null && { panels:              r.panels              }),
      ...(r.cutLengthMm         != null && { cutLengthMm:         r.cutLengthMm         }),
      ...(r.liningMetres        != null && { liningMetres:        r.liningMetres        }),
      ...(r.eyeletCountPerPanel != null && { eyeletCountPerPanel: r.eyeletCountPerPanel }),
    },
    warnings: r.warnings,
  };
}
