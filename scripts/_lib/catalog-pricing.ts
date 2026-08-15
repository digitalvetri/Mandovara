// Deterministic per-SKU price generator for the seeded catalog.
//
// Every colourway gets a price picked from a family-specific band, indexed
// by a stable hash of its code — so the same catalogue row always resolves
// to the same rupee value across re-runs of the importer or the updater.
// Prices are snapped to a nice step (₹25 / ₹100 / ₹250) so the tags read
// like real showroom rate cards, not float noise.

export interface PriceBand {
  minPaise:  number;
  maxPaise:  number;
  stepPaise: number;
}

// Bands are anchored around the flat rates the owner originally supplied
// in scripts/add-catalog-xlsx.ts, widened downward and upward to reflect
// the real showroom range for each family.
export const FAMILY_PRICE_BANDS: Record<string, PriceBand> = {
  WALLPAPER:         { minPaise: 150_000,   maxPaise: 500_000,   stepPaise: 25_000 },
  CURTAIN_FABRIC:    { minPaise:  70_000,   maxPaise: 240_000,   stepPaise: 10_000 },
  SHEER:             { minPaise:  40_000,   maxPaise: 150_000,   stepPaise: 10_000 },
  UPHOLSTERY_FABRIC: { minPaise:  50_000,   maxPaise: 200_000,   stepPaise: 10_000 },
  FLOORING:          { minPaise: 450_000,   maxPaise: 1_200_000, stepPaise: 25_000 },
  CARPET_ROLL:       { minPaise:  15_000,   maxPaise:  60_000,   stepPaise:  2_500 },
  CARPET_TILE:       { minPaise:  18_000,   maxPaise:  70_000,   stepPaise:  2_500 },
  RUG:               { minPaise: 350_000,   maxPaise: 3_500_000, stepPaise: 50_000 },
  BLIND:             { minPaise:  20_000,   maxPaise:  65_000,   stepPaise:  2_500 },
  INTERIOR_FILM:     { minPaise:  15_000,   maxPaise:  55_000,   stepPaise:  2_500 },
  VERTICAL_GARDEN:   { minPaise: 200_000,   maxPaise: 600_000,   stepPaise: 25_000 },
  MURAL:             { minPaise: 300_000,   maxPaise: 1_500_000, stepPaise: 50_000 },
};

// Falls back to the CURTAIN_FABRIC band for any family we haven't tuned yet.
const DEFAULT_BAND: PriceBand = FAMILY_PRICE_BANDS["CURTAIN_FABRIC"]!;

// djb2 — fast, stable, no external deps. Returns a positive 31-bit int.
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  }
  return h & 0x7fffffff;
}

/**
 * Deterministic price for a given family + SKU code.
 * Same inputs always return the same rupee value.
 */
export function priceFor(family: string, code: string): bigint {
  const band = FAMILY_PRICE_BANDS[family] ?? DEFAULT_BAND;
  const steps = Math.floor((band.maxPaise - band.minPaise) / band.stepPaise) + 1;
  const idx = hash(code) % steps;
  return BigInt(band.minPaise + idx * band.stepPaise);
}
