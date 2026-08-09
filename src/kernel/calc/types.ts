// Shared types for the Measure & Material Engine (§7).
// All input dimensions are in millimetres. Money is never in this package.

export type PatternMatch   = "FREE" | "STRAIGHT" | "OFFSET";
export type FabricRun      = "VERTICAL" | "RAILROADED";
export type HeadingType    = "EYELET" | "PINCH_PLEAT" | "PENCIL_PLEAT" | "RIPPLE_FOLD" | "TAB_TOP" | "ROD_POCKET";
export type MountType      = "INSIDE" | "OUTSIDE" | "CEILING";
export type LayPattern     = "STRAIGHT" | "DIAGONAL" | "HERRINGBONE";
export type CarpetMode     = "ROLL" | "TILE";

export interface Deduction {
  label?: string;
  widthMm: number;
  heightMm: number;
  qty?: number; // default 1
}
