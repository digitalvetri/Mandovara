// Pure Excel parser for catalog design bulk import.
// No I/O: accepts a Buffer, returns { valid, errors }.
// Testable without a database connection.

import * as XLSX from "xlsx";
import { z } from "zod";
import { ProductFamilyEnum, PatternMatchEnum } from "./schema";

// ── Public types ──────────────────────────────────────────────────────────────

export interface ImportError {
  row: number;    // 1-based data row (spreadsheet row 2 = data row 1)
  field: string;
  reason: string;
}

export interface ValidDesignRow {
  rowNumber: number;
  brandName: string;
  collectionName: string;
  code: string;
  name: string;
  family: z.infer<typeof ProductFamilyEnum>;
  hsn: string;
  gstRate: number;
  rollWidthMm: number | null;
  rollLengthM: number | null;
  fabricWidthMm: number | null;
  patternRepeatMm: number | null;
  patternMatch: z.infer<typeof PatternMatchEnum>;
  railroadable: boolean;
  gsm: number | null;
  areaPerBoxSqft: number | null;
  tileSizeMm: string | null;
}

export interface ParseResult {
  valid: ValidDesignRow[];
  errors: ImportError[];
}

// ── Row schema ────────────────────────────────────────────────────────────────

// SheetJS returns JS types from Excel cells: number for numeric cells,
// string for string cells, boolean for boolean cells, null (defval) for absent cells.
// Required string fields use min(1) to reject both null and empty string.

const RowSchema = z.object({
  brand_name: z.string().min(1, "brand_name is required"),
  collection_name: z.string().min(1, "collection_name is required"),
  design_code: z.string().min(1, "design_code is required").max(60),
  design_name: z.string().min(1, "design_name is required").max(120),
  family: ProductFamilyEnum,
  hsn: z.string().min(4, "hsn must be 4–8 characters").max(8),
  gst_rate: z.number()
    .min(0, "gst_rate cannot be negative")
    .max(28, "gst_rate cannot exceed 28"),
  // Optional physical properties — nullable so absent cells (null) pass through
  roll_width_mm: z.number().positive().nullable().optional(),
  roll_length_m: z.number().positive().nullable().optional(),
  fabric_width_mm: z.number().positive().nullable().optional(),
  pattern_repeat_mm: z.number().min(0).nullable().optional(),
  pattern_match: PatternMatchEnum.nullable().optional(),
  railroadable: z.boolean().nullable().optional(),
  gsm: z.number().int().positive().nullable().optional(),
  area_per_box_sqft: z.number().positive().nullable().optional(),
  tile_size_mm: z.string().max(20).nullable().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function validatePatternConstraint(
  patternRepeatMm: number | null | undefined,
  patternMatch: string | null | undefined,
): string | null {
  const repeat = patternRepeatMm ?? 0;
  const match = patternMatch ?? "FREE";
  if (repeat > 0 && match === "FREE") {
    return "pattern_repeat_mm > 0 requires pattern_match to be STRAIGHT or OFFSET, not FREE";
  }
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function parseDesignRows(buffer: Buffer): ParseResult {
  const wb = XLSX.read(buffer, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
  });

  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { valid: [], errors: [{ row: 0, field: "file", reason: "Workbook has no sheets" }] };
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { valid: [], errors: [{ row: 0, field: "file", reason: "Sheet is empty" }] };
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  const valid: ValidDesignRow[] = [];
  const errors: ImportError[] = [];
  const seenCodes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1; // 1-based data row
    const raw = rows[i]!;
    const parsed = RowSchema.safeParse(raw);

    if (!parsed.success) {
      // One error per field per row — de-duplicate by path
      const reported = new Set<string>();
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".") || "unknown";
        if (!reported.has(field)) {
          errors.push({ row: rowNum, field, reason: issue.message });
          reported.add(field);
        }
      }
      continue;
    }

    const d = parsed.data;

    // Cross-field constraint: pattern repeat must be paired with a non-FREE match
    const patternErr = validatePatternConstraint(d.pattern_repeat_mm, d.pattern_match);
    if (patternErr) {
      errors.push({ row: rowNum, field: "pattern_match", reason: patternErr });
      continue;
    }

    // Within-file duplicate design_code
    if (seenCodes.has(d.design_code)) {
      errors.push({
        row: rowNum,
        field: "design_code",
        reason: `Duplicate design_code "${d.design_code}" within import file`,
      });
      continue;
    }
    seenCodes.add(d.design_code);

    valid.push({
      rowNumber: rowNum,
      brandName: d.brand_name,
      collectionName: d.collection_name,
      code: d.design_code,
      name: d.design_name,
      family: d.family,
      hsn: d.hsn,
      gstRate: d.gst_rate,
      rollWidthMm: d.roll_width_mm ?? null,
      rollLengthM: d.roll_length_m ?? null,
      fabricWidthMm: d.fabric_width_mm ?? null,
      patternRepeatMm: d.pattern_repeat_mm ?? null,
      patternMatch: d.pattern_match ?? "FREE",
      railroadable: d.railroadable ?? false,
      gsm: d.gsm ?? null,
      areaPerBoxSqft: d.area_per_box_sqft ?? null,
      tileSizeMm: d.tile_size_mm ?? null,
    });
  }

  return { valid, errors };
}
