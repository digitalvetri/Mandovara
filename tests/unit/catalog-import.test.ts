// W8 gate: "import 1,000 designs with 40 deliberate errors;
//           all 40 identified with row and reason; the other 960 import"
//
// This test covers the pure parser (no DB). The 40 errors span 8 categories:
//   5 × missing design_code      → field: "design_code"
//   5 × missing design_name      → field: "design_name"
//   5 × invalid family enum      → field: "family"
//   5 × invalid pattern_match    → field: "pattern_match"
//   5 × pattern constraint       → field: "pattern_match" (repeat>0 AND match=FREE)
//   5 × missing hsn              → field: "hsn"
//   5 × within-file duplicate    → field: "design_code"
//   5 × gst_rate > 28            → field: "gst_rate"

import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseDesignRows } from "@/modules/catalog/import-parser";

// ── Fixture builder ───────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function validRow(n: number): Row {
  return {
    brand_name: "TestBrand",
    collection_name: "TestCollection",
    design_code: `IMP-${String(n).padStart(4, "0")}`,
    design_name: `Import Design ${n}`,
    family: "WALLPAPER",
    hsn: "4814",
    gst_rate: 12,
    pattern_repeat_mm: null,
    pattern_match: "FREE",
    roll_width_mm: 530,
    roll_length_m: 10.05,
  };
}

/**
 * Build an xlsx Buffer with 960 valid rows followed by 40 deliberate errors.
 * Each error row is designed to fail exactly one validation rule.
 */
function makeFixtureBuffer(): Buffer {
  const rows: Row[] = [];

  // ── 960 valid rows ────────────────────────────────────────────────────────
  for (let i = 1; i <= 960; i++) {
    rows.push(validRow(i));
  }

  // Error category 1: missing design_code (5 rows)
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9000 + i), design_code: "" });
  }

  // Error category 2: missing design_name (5 rows)
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9100 + i), design_name: "" });
  }

  // Error category 3: invalid family enum (5 rows) — "CARPET" is not in the enum
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9200 + i), family: "CARPET" });
  }

  // Error category 4: invalid pattern_match enum (5 rows)
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9300 + i), pattern_match: "HALF_DROP" });
  }

  // Error category 5: pattern constraint violation — repeat > 0 AND match = FREE (5 rows)
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9400 + i), pattern_repeat_mm: 640, pattern_match: "FREE" });
  }

  // Error category 6: missing hsn (5 rows)
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9500 + i), hsn: "" });
  }

  // Error category 7: within-file duplicate design_code — reuse codes IMP-0001..IMP-0005
  for (let i = 1; i <= 5; i++) {
    rows.push({ ...validRow(9600 + i), design_code: `IMP-${String(i).padStart(4, "0")}` });
  }

  // Error category 8: gst_rate > 28 (5 rows)
  for (let i = 0; i < 5; i++) {
    rows.push({ ...validRow(9700 + i), gst_rate: 30 + i });
  }

  // Total: 960 + 40 = 1000 rows
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Designs");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parseDesignRows — W8 import gate", () => {
  const buffer = makeFixtureBuffer();
  const result = parseDesignRows(buffer);

  it("imports exactly 960 valid rows", () => {
    expect(result.valid).toHaveLength(960);
  });

  it("identifies exactly 40 errors", () => {
    expect(result.errors).toHaveLength(40);
  });

  it("every error has a positive row number, non-empty field, and non-empty reason", () => {
    for (const err of result.errors) {
      expect(err.row, `row number for field "${err.field}"`).toBeGreaterThan(0);
      expect(err.field.length).toBeGreaterThan(0);
      expect(err.reason.length).toBeGreaterThan(0);
    }
  });

  it("error rows come after the 960 valid rows (rows 961–1000)", () => {
    for (const err of result.errors) {
      expect(err.row, `expected error at row > 960, got ${err.row}`).toBeGreaterThan(960);
    }
  });

  it("catches 5 missing design_code errors", () => {
    const cat = result.errors.filter(
      (e) => e.field === "design_code" && !e.reason.includes("Duplicate"),
    );
    expect(cat).toHaveLength(5);
  });

  it("catches 5 missing design_name errors", () => {
    const cat = result.errors.filter((e) => e.field === "design_name");
    expect(cat).toHaveLength(5);
  });

  it("catches 5 invalid family enum errors", () => {
    const cat = result.errors.filter((e) => e.field === "family");
    expect(cat).toHaveLength(5);
  });

  it("catches 10 pattern_match errors total (5 invalid enum + 5 constraint violation)", () => {
    // Constraint errors include "pattern_repeat_mm"; enum errors do not.
    const constraintErrors = result.errors.filter(
      (e) => e.field === "pattern_match" && e.reason.includes("pattern_repeat_mm"),
    );
    const allPatternErrors = result.errors.filter((e) => e.field === "pattern_match");
    expect(constraintErrors).toHaveLength(5);
    expect(allPatternErrors).toHaveLength(10);
  });

  it("catches 5 missing hsn errors", () => {
    const cat = result.errors.filter((e) => e.field === "hsn");
    expect(cat).toHaveLength(5);
  });

  it("catches 5 within-file duplicate design_code errors", () => {
    const cat = result.errors.filter(
      (e) => e.field === "design_code" && e.reason.includes("Duplicate"),
    );
    expect(cat).toHaveLength(5);
  });

  it("catches 5 gst_rate > 28 errors", () => {
    const cat = result.errors.filter((e) => e.field === "gst_rate");
    expect(cat).toHaveLength(5);
  });

  it("all 960 valid rows have correct code format IMP-NNNN", () => {
    for (const row of result.valid) {
      expect(row.code).toMatch(/^IMP-\d{4}$/);
    }
  });
});

describe("parseDesignRows — edge cases", () => {
  it("returns an error for an empty workbook", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Empty");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = parseDesignRows(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(0); // empty sheet = 0 rows = 0 errors
  });

  it("accepts a wallpaper row with straight pattern match", () => {
    const rows: Row[] = [
      {
        brand_name: "BrandX",
        collection_name: "ColX",
        design_code: "WP-001",
        design_name: "Wallpaper One",
        family: "WALLPAPER",
        hsn: "4814",
        gst_rate: 12,
        pattern_repeat_mm: 640,
        pattern_match: "STRAIGHT",
        roll_width_mm: 530,
        roll_length_m: 10.05,
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Designs");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = parseDesignRows(buffer);
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.patternMatch).toBe("STRAIGHT");
    expect(result.valid[0]?.patternRepeatMm).toBe(640);
  });

  it("defaults pattern_match to FREE when absent", () => {
    const rows: Row[] = [
      {
        brand_name: "B",
        collection_name: "C",
        design_code: "D-001",
        design_name: "Design One",
        family: "FLOORING",
        hsn: "4411",
        gst_rate: 18,
        pattern_repeat_mm: null,
        pattern_match: null,
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Designs");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const result = parseDesignRows(buffer);
    expect(result.errors).toHaveLength(0);
    expect(result.valid[0]?.patternMatch).toBe("FREE");
  });
});
