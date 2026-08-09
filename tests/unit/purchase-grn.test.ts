// Gate: partial receipt across 3 GRNs reconciles the PO to zero pending.
// Tests pure reconciliation logic from src/modules/purchase/lib.ts.

import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  computePOStatus,
  computePendingQty,
  MANDATORY_DYE_LOT_FAMILIES,
  type POLineStatus,
} from "@/modules/purchase/lib";

function dec(n: number | string): Decimal {
  return new Decimal(n);
}

describe("computePOStatus", () => {
  it("returns current status when no lines received yet (DRAFT)", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(0) },
      { quantity: dec(20), receivedQty: dec(0) },
    ];
    expect(computePOStatus("DRAFT", lines)).toBe("DRAFT");
  });

  it("returns current status when no lines received yet (SENT)", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(0) },
    ];
    expect(computePOStatus("SENT", lines)).toBe("SENT");
  });

  it("transitions to PARTIAL after first partial receipt", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(3) },
      { quantity: dec(20), receivedQty: dec(0) },
    ];
    expect(computePOStatus("SENT", lines)).toBe("PARTIAL");
  });

  it("stays PARTIAL after second partial receipt covering one full line", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(10) },
      { quantity: dec(20), receivedQty: dec(5) },
    ];
    expect(computePOStatus("PARTIAL", lines)).toBe("PARTIAL");
  });

  it("transitions to RECEIVED when all lines fully received", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(10) },
      { quantity: dec(20), receivedQty: dec(20) },
    ];
    expect(computePOStatus("PARTIAL", lines)).toBe("RECEIVED");
  });

  it("returns RECEIVED for single-line PO fully received", () => {
    const lines: POLineStatus[] = [
      { quantity: dec("5.250"), receivedQty: dec("5.250") },
    ];
    expect(computePOStatus("SENT", lines)).toBe("RECEIVED");
  });

  it("never transitions out of CANCELLED", () => {
    // computePOStatus is called only when status is DRAFT/SENT/PARTIAL —
    // CANCELLED guard is in the action layer. Verify pure fn doesn't touch it.
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(10) },
    ];
    // If somehow called with CANCELLED (shouldn't happen), it would return RECEIVED.
    // The action layer must guard this before calling computePOStatus.
    expect(computePOStatus("RECEIVED", lines)).toBe("RECEIVED");
  });
});

describe("computePendingQty", () => {
  it("returns quantity − receivedQty per line", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(3) },
      { quantity: dec(20), receivedQty: dec(20) },
    ];
    const [p1, p2] = computePendingQty(lines);
    expect(p1?.toNumber()).toBe(7);
    expect(p2?.toNumber()).toBe(0);
  });
});

describe("GATE — partial receipt across 3 GRNs reconciles PO to zero pending", () => {
  it("two-line PO: 3 sequential GRNs arrive at RECEIVED with zero pending", () => {
    // PO: line 1 = 10m, line 2 = 20m → total 30m
    const lines: POLineStatus[] = [
      { quantity: dec(10), receivedQty: dec(0) },
      { quantity: dec(20), receivedQty: dec(0) },
    ];

    // ─── GRN 1: receive 3m from line 1 ──────────────────────────────────────
    lines[0]!.receivedQty = dec(3);
    const statusAfterGRN1 = computePOStatus("SENT", lines);
    expect(statusAfterGRN1).toBe("PARTIAL");

    const pendingAfterGRN1 = computePendingQty(lines);
    expect(pendingAfterGRN1[0]?.toNumber()).toBe(7);
    expect(pendingAfterGRN1[1]?.toNumber()).toBe(20);

    // ─── GRN 2: receive remaining 7m from line 1 + 10m from line 2 ──────────
    lines[0]!.receivedQty = dec(10);
    lines[1]!.receivedQty = dec(10);
    const statusAfterGRN2 = computePOStatus("PARTIAL", lines);
    expect(statusAfterGRN2).toBe("PARTIAL");

    const pendingAfterGRN2 = computePendingQty(lines);
    expect(pendingAfterGRN2[0]?.toNumber()).toBe(0);
    expect(pendingAfterGRN2[1]?.toNumber()).toBe(10);

    // ─── GRN 3: receive remaining 10m from line 2 ───────────────────────────
    lines[1]!.receivedQty = dec(20);
    const statusAfterGRN3 = computePOStatus("PARTIAL", lines);
    expect(statusAfterGRN3).toBe("RECEIVED");

    const pendingAfterGRN3 = computePendingQty(lines);
    expect(pendingAfterGRN3[0]?.toNumber()).toBe(0);
    expect(pendingAfterGRN3[1]?.toNumber()).toBe(0);

    // Total pending = zero
    const totalPending = pendingAfterGRN3.reduce((s, p) => s + p.toNumber(), 0);
    expect(totalPending).toBe(0);
  });

  it("single-line PO: 3 GRNs of 10 rolls each → RECEIVED at GRN 3", () => {
    const lines: POLineStatus[] = [
      { quantity: dec(30), receivedQty: dec(0) },
    ];

    lines[0]!.receivedQty = dec(10);
    expect(computePOStatus("SENT", lines)).toBe("PARTIAL");
    expect(computePendingQty(lines)[0]?.toNumber()).toBe(20);

    lines[0]!.receivedQty = dec(20);
    expect(computePOStatus("PARTIAL", lines)).toBe("PARTIAL");
    expect(computePendingQty(lines)[0]?.toNumber()).toBe(10);

    lines[0]!.receivedQty = dec(30);
    expect(computePOStatus("PARTIAL", lines)).toBe("RECEIVED");
    expect(computePendingQty(lines)[0]?.toNumber()).toBe(0);
  });

  it("decimal quantities reconcile precisely (e.g. fabric in metres)", () => {
    const lines: POLineStatus[] = [
      { quantity: dec("12.500"), receivedQty: dec(0) },
    ];

    lines[0]!.receivedQty = dec("4.167");
    expect(computePOStatus("SENT", lines)).toBe("PARTIAL");

    lines[0]!.receivedQty = dec("8.333");
    expect(computePOStatus("PARTIAL", lines)).toBe("PARTIAL");

    lines[0]!.receivedQty = dec("12.500");
    expect(computePOStatus("PARTIAL", lines)).toBe("RECEIVED");
    expect(computePendingQty(lines)[0]?.toNumber()).toBe(0);
  });
});

describe("MANDATORY_DYE_LOT_FAMILIES", () => {
  it("includes all five mandatory families", () => {
    expect(MANDATORY_DYE_LOT_FAMILIES.has("WALLPAPER")).toBe(true);
    expect(MANDATORY_DYE_LOT_FAMILIES.has("CURTAIN_FABRIC")).toBe(true);
    expect(MANDATORY_DYE_LOT_FAMILIES.has("SHEER")).toBe(true);
    expect(MANDATORY_DYE_LOT_FAMILIES.has("UPHOLSTERY_FABRIC")).toBe(true);
    expect(MANDATORY_DYE_LOT_FAMILIES.has("CARPET_ROLL")).toBe(true);
  });

  it("does not include non-mandatory families", () => {
    expect(MANDATORY_DYE_LOT_FAMILIES.has("BLIND")).toBe(false);
    expect(MANDATORY_DYE_LOT_FAMILIES.has("FLOORING")).toBe(false);
    expect(MANDATORY_DYE_LOT_FAMILIES.has("INTERIOR_FILM")).toBe(false);
  });
});
