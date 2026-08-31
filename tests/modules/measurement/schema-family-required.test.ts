// §6.4 family-specific required fields — enforced in schema.superRefine.
// Spec §10 "Unit → Family-specific required-field validation".

import { describe, it, expect } from "vitest";
import { addItemSchema } from "../../../src/modules/measurement/schema";
import { FIELD_PLAN, asks } from "../../../src/modules/measurement/simple-field-plan";
import { SIMPLE_FAMILIES } from "../../../src/modules/measurement/simple-families";

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

// ── Curtain-only optional fields (2026-08-31) ────────────────────────────
//
// The owner asked for a curtain to take parts and meters, and for wallpaper
// to take neither. The FORM enforces which fields are shown
// (simple-field-plan.ts); the SCHEMA only has to accept them and reject
// nonsense, because a stale value surviving a family switch is a bug worth
// catching in the client, not a reason to fail a save.
describe("addItemSchema · parts and runningMeters", () => {
  const curtain = { ...base, family: "CURTAIN_FABRIC" as const, headingType: "EYELET" as const, fullness: 2 };

  it("accepts a curtain with parts and runningMeters", () => {
    const r = addItemSchema.safeParse({ ...curtain, parts: 2, runningMeters: 14.5 });
    expect(r.success).toBe(true);
  });

  it("accepts a curtain with neither — both are optional", () => {
    expect(addItemSchema.safeParse(curtain).success).toBe(true);
  });

  it("rejects a fractional parts count", () => {
    const r = addItemSchema.safeParse({ ...curtain, parts: 2.5 });
    expect(r.success).toBe(false);
  });

  it("rejects zero or negative parts", () => {
    expect(addItemSchema.safeParse({ ...curtain, parts: 0 }).success).toBe(false);
    expect(addItemSchema.safeParse({ ...curtain, parts: -1 }).success).toBe(false);
  });

  it("rejects runningMeters of zero", () => {
    expect(addItemSchema.safeParse({ ...curtain, runningMeters: 0 }).success).toBe(false);
  });
});

describe("simple field plan · what each family asks for", () => {
  it("curtain and sheer ask height, width, parts, meters — and not quantity", () => {
    for (const f of ["CURTAIN_FABRIC", "SHEER"] as const) {
      expect(FIELD_PLAN[f].map((x) => x.key)).toEqual(["height", "width", "parts", "meters"]);
      expect(asks(f, "quantity")).toBe(false);
    }
  });

  it("wallpaper asks height, width and quantity — and not parts or meters", () => {
    expect(FIELD_PLAN.WALLPAPER.map((x) => x.key)).toEqual(["height", "width", "quantity"]);
    expect(asks("WALLPAPER", "parts")).toBe(false);
    expect(asks("WALLPAPER", "meters")).toBe(false);
  });

  it("marks parts, meters and quantity optional but never the dimensions", () => {
    for (const specs of Object.values(FIELD_PLAN)) {
      for (const s of specs) {
        if (s.key === "width" || s.key === "height") expect(s.optional).toBe(false);
        else expect(s.optional).toBe(true);
      }
    }
  });

  it("covers every family the simple form offers", () => {
    for (const f of SIMPLE_FAMILIES) expect(FIELD_PLAN[f]?.length).toBeGreaterThan(0);
  });
});
