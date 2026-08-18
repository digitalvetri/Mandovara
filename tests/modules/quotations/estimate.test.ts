// A quotation with nothing measured behind it must present as an ESTIMATE.
//
// §15.1 blocks a CATALOG made-to-measure line with no MeasurementItem. It
// cannot catch a line written in words — "Curtains, 3 bedrooms, ₹45,000" has
// no family to gate on. That path is legitimate (a website enquiry needs a
// price today) but it must never read as a measured quotation, because
// quoting before measuring is exactly where the margin goes (§1.2).

import { describe, it, expect } from "vitest";
import { isEstimate, ESTIMATE_CAVEAT } from "@/modules/quotations/lib";
import { createEstimateSchema } from "@/modules/quotations/estimate-schemas";

const ID = "c".repeat(25);

describe("isEstimate", () => {
  it("is true when no line carries a measurement", () => {
    expect(isEstimate([{ measurementItemId: null }, { measurementItemId: null }])).toBe(true);
  });

  it("is false as soon as ONE line is measured", () => {
    expect(isEstimate([{ measurementItemId: null }, { measurementItemId: "mi_1" }])).toBe(false);
  });

  it("is false when every line is measured", () => {
    expect(isEstimate([{ measurementItemId: "a" }, { measurementItemId: "b" }])).toBe(false);
  });

  it("treats undefined the same as null", () => {
    expect(isEstimate([{}, {}])).toBe(true);
  });

  it("is false for an empty document — nothing to describe", () => {
    expect(isEstimate([])).toBe(false);
  });

  it("the caveat names the next action", () => {
    expect(ESTIMATE_CAVEAT).toMatch(/site measurement/i);
  });
});

describe("createEstimateSchema", () => {
  const line = { description: "Curtains — 3 bedrooms", quantity: 1, unit: "SET", rate: "45000", gstRate: 18 };

  it("accepts a free-text line with no catalogue product", () => {
    const r = createEstimateSchema.safeParse({
      branchId: ID, newLead: { name: "Anand Kumar", mobile: "+919876543210" }, lines: [line],
    });
    expect(r.success).toBe(true);
  });

  it("requires exactly one recipient", () => {
    const base = { branchId: ID, lines: [line] };
    expect(createEstimateSchema.safeParse(base).success, "none").toBe(false);
    expect(createEstimateSchema.safeParse({
      ...base, leadId: ID, clientId: ID,
    }).success, "two").toBe(false);
    expect(createEstimateSchema.safeParse({ ...base, leadId: ID }).success, "lead").toBe(true);
    expect(createEstimateSchema.safeParse({ ...base, clientId: ID }).success, "client").toBe(true);
  });

  it("requires at least one line", () => {
    expect(createEstimateSchema.safeParse({
      branchId: ID, leadId: ID, lines: [],
    }).success).toBe(false);
  });

  it("rejects a line with no description or a non-positive quantity", () => {
    for (const bad of [{ ...line, description: "" }, { ...line, quantity: 0 }]) {
      expect(createEstimateSchema.safeParse({ branchId: ID, leadId: ID, lines: [bad] }).success).toBe(false);
    }
  });

  it("rejects a GST rate outside the statutory range", () => {
    expect(createEstimateSchema.safeParse({
      branchId: ID, leadId: ID, lines: [{ ...line, gstRate: 40 }],
    }).success).toBe(false);
  });

  it("defaults validity to 15 days and discount to zero", () => {
    const r = createEstimateSchema.safeParse({ branchId: ID, leadId: ID, lines: [line] });
    expect(r.success && r.data.validForDays).toBe(15);
    expect(r.success && r.data.lines[0]!.discountPct).toBe(0);
  });

  it("requires a name and mobile for a brand-new enquirer", () => {
    for (const bad of [{ name: "A", mobile: "+919876543210" }, { name: "Anand", mobile: "123" }]) {
      expect(createEstimateSchema.safeParse({ branchId: ID, newLead: bad, lines: [line] }).success).toBe(false);
    }
  });
});
