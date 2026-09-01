// The point of recording an entry unit is that a person reads back the
// number they wrote down. So the test is a round trip over TYPED values,
// not over millimetres: type 60 inches, get "60" — not "1524", not
// "60.0".

import { describe, it, expect } from "vitest";
import {
  toMm, fromMm, asUnit, trimZeros, displayDimension, type Unit,
} from "@/modules/measurement/units";

describe("unit round trip", () => {
  const cases: Record<Unit, string[]> = {
    in: ["60", "96", "7", "7.5", "144", "18.5"],
    ft: ["7", "8", "12", "7.5", "10.25"],
    mm: ["1524", "2400", "300"],
  };

  for (const [unit, typed] of Object.entries(cases) as [Unit, string[]][]) {
    for (const value of typed) {
      it(`${value} ${unit} survives the trip through millimetres`, () => {
        const mm = toMm(value, unit);
        expect(mm).not.toBeNull();
        expect(fromMm(mm as number, unit)).toBe(value);
      });
    }
  }

  it("stores the same millimetres regardless of the unit typed", () => {
    // 60 inch and 5 ft are the same window.
    expect(toMm("60", "in")).toBeCloseTo(toMm("5", "ft") as number, 6);
  });
});

describe("fromMm", () => {
  it("does not invent precision the measurer never gave", () => {
    expect(fromMm(1524, "in")).toBe("60");        // not "60.0"
    expect(fromMm(2133.6, "ft")).toBe("7");       // not "7.00"
  });

  it("keeps a real fraction", () => {
    expect(fromMm(190.5, "in")).toBe("7.5");
    expect(fromMm(2286, "ft")).toBe("7.5");
  });

  it("rounds millimetres to whole numbers", () => {
    expect(fromMm(1524.38, "mm")).toBe("1524");
  });

  it("returns empty for a value that is not a number", () => {
    expect(fromMm(NaN, "in")).toBe("");
  });
});

describe("toMm", () => {
  it("refuses zero, negatives and rubbish", () => {
    for (const bad of ["0", "-4", "abc", ""]) {
      expect(toMm(bad, "in")).toBeNull();
    }
  });
});

describe("displayDimension", () => {
  it("reads a row back in the unit it was typed in", () => {
    expect(displayDimension("1524.00", "in")).toEqual({ value: "60", unit: "inch" });
    expect(displayDimension("2133.60", "ft")).toEqual({ value: "7", unit: "ft" });
  });

  it("falls back to millimetres for rows measured before we recorded a unit", () => {
    // No guessing: an old row is shown as what it was stored as.
    expect(displayDimension("1524.00", null)).toEqual({ value: "1524", unit: "mm" });
    expect(displayDimension("1524.00", undefined)).toEqual({ value: "1524", unit: "mm" });
  });

  it("ignores a unit it does not recognise", () => {
    expect(displayDimension("1524.00", "cubits")).toEqual({ value: "1524", unit: "mm" });
  });
});

describe("asUnit", () => {
  it("accepts only the three units", () => {
    expect(asUnit("in")).toBe("in");
    expect(asUnit("ft")).toBe("ft");
    expect(asUnit("mm")).toBe("mm");
    expect(asUnit("cm")).toBeNull();
    expect(asUnit(null)).toBeNull();
    expect(asUnit(25.4)).toBeNull();
  });
});

describe("trimZeros", () => {
  it("leaves whole numbers alone", () => {
    expect(trimZeros("1524")).toBe("1524");
  });
  it("drops only trailing zeros", () => {
    expect(trimZeros("7.50")).toBe("7.5");
    expect(trimZeros("7.00")).toBe("7");
    expect(trimZeros("10.05")).toBe("10.05");
  });
});
