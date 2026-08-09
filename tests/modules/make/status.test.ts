// MakeJob status lifecycle — pure function tests. The kanban UI, the
// server action, and the transitions smoke script all rely on the map
// in modules/make/status.ts being the single source of truth.

import { describe, expect, it } from "vitest";
import {
  nextAllowedStatuses, canTransition, transitionOptions,
} from "@/modules/make/status";
import type { MakeJobStatus } from "@/modules/make/schema";

describe("nextAllowedStatuses", () => {
  it("walks the forward path QUEUED → … → DELIVERED", () => {
    // Chain the singleton forward moves (skipping QC which branches).
    const path: MakeJobStatus[] = ["QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC"];
    for (let i = 0; i < path.length - 1; i++) {
      const next = nextAllowedStatuses(path[i]!);
      expect(next).toContain(path[i + 1]!);
    }
  });

  it("QC branches to READY (pass) OR CUTTING (rework)", () => {
    const next = nextAllowedStatuses("QC");
    expect([...next].sort()).toEqual(["CUTTING", "READY"]);
  });

  it("READY advances only to DELIVERED", () => {
    expect(nextAllowedStatuses("READY")).toEqual(["DELIVERED"]);
  });

  it("DELIVERED is terminal (empty transition set)", () => {
    expect(nextAllowedStatuses("DELIVERED")).toEqual([]);
  });
});

describe("canTransition", () => {
  it("allows every forward transition in TRANSITIONS", () => {
    const cases: [MakeJobStatus, MakeJobStatus][] = [
      ["QUEUED", "CUTTING"],  ["CUTTING", "STITCHING"],
      ["STITCHING", "FINISHING"], ["FINISHING", "QC"],
      ["QC", "READY"], ["QC", "CUTTING"], ["READY", "DELIVERED"],
    ];
    for (const [from, to] of cases) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it("blocks illegal skips (QUEUED → READY, STITCHING → DELIVERED)", () => {
    expect(canTransition("QUEUED", "READY")).toBe(false);
    expect(canTransition("STITCHING", "DELIVERED")).toBe(false);
  });

  it("blocks backward moves outside the QC rework path", () => {
    // Once fabric is cut we don't uncut it; going back to QUEUED
    // from anywhere would corrupt the audit trail.
    expect(canTransition("CUTTING", "QUEUED")).toBe(false);
    expect(canTransition("STITCHING", "CUTTING")).toBe(false);
    expect(canTransition("FINISHING", "STITCHING")).toBe(false);
    expect(canTransition("READY", "QC")).toBe(false);
  });

  it("blocks a self-transition (idempotent 'no-op' status flip)", () => {
    // Advancing a job to its current status is a user error — reject
    // so the audit trail doesn't fill with no-op writes.
    expect(canTransition("QUEUED", "QUEUED")).toBe(false);
    expect(canTransition("DELIVERED", "DELIVERED")).toBe(false);
  });
});

describe("transitionOptions", () => {
  it("QC exposes both options with distinct tones", () => {
    const opts = transitionOptions("QC");
    const pass = opts.find((o) => o.to === "READY");
    const fail = opts.find((o) => o.to === "CUTTING");
    expect(pass?.tone).toBe("good");
    expect(fail?.tone).toBe("bad");
  });

  it("empty for terminal DELIVERED (kanban should render no buttons)", () => {
    expect(transitionOptions("DELIVERED")).toEqual([]);
  });

  it("stays in sync with nextAllowedStatuses (never orphaned)", () => {
    const all: MakeJobStatus[] = [
      "QUEUED", "CUTTING", "STITCHING", "FINISHING", "QC", "READY", "DELIVERED",
    ];
    for (const s of all) {
      const optsTo = transitionOptions(s).map((o) => o.to).sort();
      const nextTo = [...nextAllowedStatuses(s)].sort();
      expect(optsTo).toEqual(nextTo);
    }
  });
});
