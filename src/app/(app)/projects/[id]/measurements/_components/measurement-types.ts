import type { PatternMatch as WallpaperPatternMatch } from "@/lib/calc/wallpaper";
import type { LayPattern } from "@/lib/calc/flooring";
import type { PatternMatch as CurtainPatternMatch } from "@/lib/calc/curtain";

export type Family = "WALLPAPER" | "FLOORING" | "CURTAIN";

export interface WallpaperInputs {
  wallWidthMm:     number;
  wallHeightMm:    number;
  rollWidthMm:     number;
  rollLengthM:     number;
  patternMatch:    WallpaperPatternMatch;
  patternRepeatMm: number;
}
export interface FlooringInputs {
  roomLengthMm:   number;
  roomWidthMm:    number;
  layPattern:     LayPattern;
  productKind:   "BOX" | "ROLL";
  areaPerBoxSqft: number;
  rollWidthMm:    number;
}
export interface CurtainInputs {
  windowWidthMm:            number;
  windowHeightMm:           number;
  fullness:                 number;
  fabricWidthMm:            number;
  patternMatch:             CurtainPatternMatch;
  patternRepeatMm:          number;
  railroadable:             boolean;
  railroadedFabricWidthMm:  number;
  eyelet:                   boolean;
  lining:                   boolean;
}

export function wallpaperInputsFrom(v: unknown): WallpaperInputs { return v as WallpaperInputs; }
export function flooringInputsFrom(v: unknown): FlooringInputs   { return v as FlooringInputs;  }
export function curtainInputsFrom(v: unknown): CurtainInputs     { return v as CurtainInputs;   }

export function familyLabel(f: Family): string {
  return f === "WALLPAPER" ? "Wallpaper" : f === "FLOORING" ? "Flooring" : "Curtains";
}

export const DEFAULT_WALLPAPER: WallpaperInputs = {
  wallWidthMm: 4000, wallHeightMm: 2700, rollWidthMm: 530, rollLengthM: 10.05,
  patternMatch: "FREE", patternRepeatMm: 0,
};
export const DEFAULT_FLOORING: FlooringInputs = {
  roomLengthMm: 4000, roomWidthMm: 3500, layPattern: "STRAIGHT",
  productKind: "BOX", areaPerBoxSqft: 2.2, rollWidthMm: 1220,
};
export const DEFAULT_CURTAIN: CurtainInputs = {
  windowWidthMm: 1800, windowHeightMm: 2100, fullness: 2.5, fabricWidthMm: 1100,
  patternMatch: "FREE", patternRepeatMm: 0,
  railroadable: false, railroadedFabricWidthMm: 2800,
  eyelet: false, lining: false,
};
