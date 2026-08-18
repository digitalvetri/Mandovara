// Reissuing an estimate as a firm quotation.
//
// The precheck is pure so the button can explain itself before it is clicked —
// a disabled button that says "measure the site first" teaches the flow; a
// hidden one teaches nothing.

import { describe, it, expect } from "vitest";
import { canReissue, measuredLineDescription } from "@/modules/quotations/reissue-schemas";

describe("canReissue", () => {
  const ok = { isEstimate: true, projectId: "p1", approvedMeasurementItems: 4 };

  it("allows an estimate on a project with approved measurements", () => {
    expect(canReissue(ok).ok).toBe(true);
  });

  it("refuses a quotation that is already measured", () => {
    const r = canReissue({ ...ok, isEstimate: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already a measured quotation/i);
  });

  it("refuses a lead-scoped estimate and names conversion as the next step", () => {
    const r = canReissue({ ...ok, projectId: null });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/convert the lead/i);
  });

  it("refuses when nothing has been measured yet, and says so", () => {
    const r = canReissue({ ...ok, approvedMeasurementItems: 0 });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/measure the site/i);
  });

  it("refuses an estimate that has already been reissued", () => {
    const r = canReissue({ ...ok, status: "REVISED" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already been reissued/i);
  });

  it("checks in a sensible order — 'already measured' beats the other reasons", () => {
    const r = canReissue({ isEstimate: false, projectId: null, approvedMeasurementItems: 0 });
    expect(r.reason).toMatch(/already a measured quotation/i);
  });
});

describe("measuredLineDescription", () => {
  it("reads as room · opening — family", () => {
    expect(measuredLineDescription("Master Bedroom", "Window 1 — East", "CURTAIN_FABRIC"))
      .toBe("Master Bedroom · Window 1 — East — Curtain Fabric");
  });

  it("humanises every family enum it is given", () => {
    expect(measuredLineDescription("Living", "Wall A", "WALLPAPER")).toContain("Wallpaper");
    expect(measuredLineDescription("Living", "Floor", "CARPET_TILE")).toContain("Carpet Tile");
  });

  it("stays inside the description column limit", () => {
    const d = measuredLineDescription("R".repeat(300), "L".repeat(300), "BLIND");
    expect(d.length).toBeLessThanOrEqual(500);
  });
});
