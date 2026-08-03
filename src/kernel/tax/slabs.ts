// GST slabs — table-driven, effective-dated.
// Twelve Rules #7: "GST is computed by pure functions in @/kernel/tax,
// table-driven, with unit tests." All rates live here — no rates in module code.

export interface GstSlab {
  /** HSN prefix (longest match wins on lookup). */
  readonly hsnPrefix: string;
  readonly rate: number;
  readonly description: string;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
}

/**
 * Real-world sample. The RBAC editor (Session 20) can add/edit slabs;
 * this file is the initial seed. Rates chosen match what Mandovara actually
 * carries — cement, TMT, electrical, plumbing, tiles, paint, hardware, safety.
 * A fuller HSN catalogue lands with the accounting integration.
 */
export const GST_SLABS: readonly GstSlab[] = [
  // GST regime introduction date
  { hsnPrefix: "2523", rate: 28, description: "Cement",           effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "7214", rate: 18, description: "Bars & rods",      effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "8544", rate: 18, description: "Insulated wires",  effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "3917", rate: 18, description: "Plastic pipes",    effectiveFrom: new Date("2017-07-01") },
  // Ceramic tiles moved from 28% to 18% in July 2018 — real GST Council decision.
  { hsnPrefix: "6907", rate: 28, description: "Ceramic tiles (pre-2018)",
    effectiveFrom: new Date("2017-07-01"), effectiveTo: new Date("2018-07-27") },
  { hsnPrefix: "6907", rate: 18, description: "Ceramic tiles",
    effectiveFrom: new Date("2018-07-27") },
  { hsnPrefix: "3208", rate: 18, description: "Paints & varnish", effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "7318", rate: 18, description: "Fasteners",        effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "6506", rate: 12, description: "Safety headgear",  effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "4901", rate: 0,  description: "Printed books",    effectiveFrom: new Date("2017-07-01") },
  { hsnPrefix: "1001", rate: 0,  description: "Wheat, exempt",    effectiveFrom: new Date("2017-07-01") },
];

/** Default rate when no HSN prefix matches. */
export const DEFAULT_GST_RATE = 18;

/**
 * Look up the GST rate for an HSN code as of `date`.
 * Longest prefix match wins. If none matches, returns DEFAULT_GST_RATE.
 */
export function getGstRate(hsn: string, date: Date = new Date()): number {
  const matches = GST_SLABS
    .filter((s) => hsn.startsWith(s.hsnPrefix))
    .filter((s) => s.effectiveFrom <= date)
    .filter((s) => s.effectiveTo == null || s.effectiveTo > date)
    .sort((a, b) => b.hsnPrefix.length - a.hsnPrefix.length);
  const top = matches[0];
  return top ? top.rate : DEFAULT_GST_RATE;
}
