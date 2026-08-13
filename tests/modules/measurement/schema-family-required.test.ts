// §6.4 family-specific required fields — enforced in schema.superRefine.
// Spec §10 "Unit → Family-specific required-field validation".

import { describe, it, expect } from "vitest";
import { addItemSchema } from "../../../src/modules/measurement/schema";

const base = {
  measurementId: "cly0000000000000000000001",
  roomId:        "cly0000000000000000000002",
  label:         "Window 1 — East",
  surface:       "WINDOW" as const,
  widthMm:       1800,
  heightMm:      2100,
  quantity:      2,
};

describe("addItemSchema · family-specific required fields", () => {
  it("CURTAIN_FABRIC without headingType fails on the headingType path", () => {
    const r = addItemSchema.safeParse({ ...base, family: "CURTAIN_FABRIC", fullness: 2.5 });
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("headingType");
  });

  it("CURTAIN_FABRIC without fullness fails on the fullness path", () => {
    const r = addItemSchema.safeParse({ ...base, family: "CURTAIN_FABRIC", headingType: "EYELET" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("fullness");
  });

  it("SHEER has the same required fields as CURTAIN_FABRIC", () => {
    const r = addItemSchema.safeParse({ ...base, family: "SHEER" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("headingType");
    expect(paths).toContain("fullness");
  });

  it("FLOORING without layPattern fails on the layPattern path", () => {
    const r = addItemSchema.safeParse({ ...base, family: "FLOORING" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("layPattern");
  });

  it("WALLPAPER without deductions array fails on the deductions path", () => {
    const r = addItemSchema.safeParse({ ...base, family: "WALLPAPER" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const paths = r.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("deductions");
  });

  it("WALLPAPER with an EMPTY deductions array is valid", () => {
    // §6.4: array must be present but may be empty — a measurer must
    // deliberately confirm there are no openings on this wall.
    const r = addItemSchema.safeParse({ ...base, family: "WALLPAPER", deductions: [] });
    expect(r.success).toBe(true);
  });

  it("CURTAIN_FABRIC with headingType + fullness passes", () => {
    const r = addItemSchema.safeParse({
      ...base, family: "CURTAIN_FABRIC", headingType: "EYELET", fullness: 2.5,
    });
    expect(r.success).toBe(true);
  });

  it("families with no extras (INTERIOR_FILM) pass without heading/lay/deductions", () => {
    const r = addItemSchema.safeParse({ ...base, family: "INTERIOR_FILM" });
    expect(r.success).toBe(true);
  });

  it("dimensions above the 20m ceiling are rejected", () => {
    const r = addItemSchema.safeParse({ ...base, widthMm: 20_001, family: "INTERIOR_FILM" });
    expect(r.success).toBe(false);
  });

  it("zero and negative dimensions are rejected", () => {
    const r0 = addItemSchema.safeParse({ ...base, widthMm: 0, family: "INTERIOR_FILM" });
    const rN = addItemSchema.safeParse({ ...base, heightMm: -1, family: "INTERIOR_FILM" });
    expect(r0.success).toBe(false);
    expect(rN.success).toBe(false);
  });
});
