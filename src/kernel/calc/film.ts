// Interior film & vertical garden calculator — §7.6.
// Pure: no I/O, no side-effects.

export interface FilmInput {
  surfaceWidthMm:   number;
  surfaceHeightMm:  number;
  quantity:         number;
  rollWidthMm:      number;        // e.g. 1220 for 3M films
  patternRepeatMm?: number;        // 0 / omitted = FREE match
  wastagePct?:      number;        // default 8
}

export interface FilmResult {
  readonly engineVersion: "film@1.2.0";
  areaSqft:          number;
  stripsRequired:    number;
  cutLengthMm:       number;
  materialQty:       number;  // sqft with wastage
  materialUnit:      "SQFT";
  warnings:          string[];
}

export interface VerticalGardenInput {
  surfaceWidthMm:   number;
  surfaceHeightMm:  number;
  panelWidthMm:     number;   // e.g. 500
  panelHeightMm:    number;   // e.g. 500
  plantsPerSqft?:   number;   // density, default 4
}

export interface VerticalGardenResult {
  readonly engineVersion: "vgarden@1.2.0";
  areaSqft:         number;
  panelsRequired:   number;
  plantCount:       number;
  irrigationRft:    number;  // perimeter in running feet
  materialUnit:     "SQFT";
  warnings:         string[];
}

const FILM_VERSION    = "film@1.2.0"    as const;
const VGARDEN_VERSION = "vgarden@1.2.0" as const;
const MM2_PER_SQFT    = 92_903.04;

export function calcFilm(input: FilmInput): FilmResult {
  const {
    surfaceWidthMm,
    surfaceHeightMm,
    quantity,
    rollWidthMm,
    patternRepeatMm = 0,
    wastagePct      = 8,
  } = input;

  const warnings: string[] = [];

  // Cut length (film treated as FREE unless repeat specified)
  let cutLengthMm = surfaceHeightMm;
  if (patternRepeatMm > 0) {
    cutLengthMm = Math.ceil(surfaceHeightMm / patternRepeatMm) * patternRepeatMm;
    warnings.push(
      `Pattern repeat (${patternRepeatMm}mm) applied: cut length extended to ${cutLengthMm}mm.`,
    );
  }

  const stripsRequired  = Math.ceil(surfaceWidthMm / rollWidthMm);
  const rawAreaSqft     = (surfaceWidthMm * surfaceHeightMm) / MM2_PER_SQFT;
  const materialQty     = parseFloat(
    (rawAreaSqft * quantity * (1 + wastagePct / 100)).toFixed(3),
  );

  return {
    engineVersion:  FILM_VERSION,
    areaSqft:       parseFloat((rawAreaSqft * quantity).toFixed(3)),
    stripsRequired: stripsRequired * quantity,
    cutLengthMm,
    materialQty,
    materialUnit:   "SQFT",
    warnings,
  };
}

export function calcVerticalGarden(input: VerticalGardenInput): VerticalGardenResult {
  const {
    surfaceWidthMm,
    surfaceHeightMm,
    panelWidthMm,
    panelHeightMm,
    plantsPerSqft = 4,
  } = input;

  const warnings: string[] = [];
  const areaSqft         = parseFloat(
    ((surfaceWidthMm * surfaceHeightMm) / MM2_PER_SQFT).toFixed(3),
  );
  const panelAreaSqft    = (panelWidthMm * panelHeightMm) / MM2_PER_SQFT;
  const panelsRequired   = Math.ceil(areaSqft / panelAreaSqft);
  const plantCount       = Math.ceil(areaSqft * plantsPerSqft);

  // Perimeter irrigation running feet
  const irrigationRft = parseFloat(
    ((2 * (surfaceWidthMm + surfaceHeightMm)) / 304.8).toFixed(2),
  );

  if (plantsPerSqft < 2) {
    warnings.push("Low plant density (< 2 per sqft) — verify with landscape supplier.");
  }

  return {
    engineVersion:   VGARDEN_VERSION,
    areaSqft,
    panelsRequired,
    plantCount,
    irrigationRft,
    materialUnit:    "SQFT",
    warnings,
  };
}
