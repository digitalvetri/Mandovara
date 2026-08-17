/**
 * Phase 7 gate — payroll kernel unit verification (no database required).
 * Mirrors the "Phase 7 gate: payroll kernel unit cases" block in
 * tests/modules/hr/payroll-gate.test.ts but extracted so they run without
 * Testcontainers / Postgres.
 *
 * Every expectation has a manual calculation comment so the numbers
 * can be audited without running the code.
 */

import { describe, it, expect } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import {
  computePayslip,
  type StatutorySlabInput,
} from "@/kernel/payroll/compute";

// ── Shared slab set (TN, FY 2025-26) ────────────────────────────────────────

const PF_SLAB:   StatutorySlabInput = { kind: "PF",     fromAmount: 0n, toAmount: null, rate: new Decimal("12.000"), flatAmount: null };
const ESI_SLAB:  StatutorySlabInput = { kind: "ESI_EE", fromAmount: 0n, toAmount: 2_100_000n, rate: new Decimal("0.750"), flatAmount: null };
const PT_NIL:    StatutorySlabInput = { kind: "PT",     fromAmount: 0n, toAmount: 2_100_000n, rate: null, flatAmount: 0n };
const PT_FULL:   StatutorySlabInput = { kind: "PT",     fromAmount: 2_100_001n, toAmount: null, rate: null, flatAmount: 20_000n };

const SLABS = [PF_SLAB, ESI_SLAB, PT_NIL, PT_FULL];

// ── Structure A: ₹59,000 gross — high earner ────────────────────────────────

describe("Structure A (basic 40k + HRA 16k + conv 3k = gross 59k), 0 LOP", () => {
  const r = computePayslip(
    { basic: "40000", hra: "16000", conveyance: "3000" },
    { absentDays: 0, halfDays: 0 },
    SLABS,
  );

  it("gross = 59 000 × 100 paise", () => {
    // 40000 + 16000 + 3000 = 59000 ₹ → 5 900 000 paise
    expect(r.earnings.gross).toBe(5_900_000n);
  });

  it("PF = 12% × basic = 12% × 40 000 × 100 = 480 000 paise (₹4 800)", () => {
    expect(r.deductions.pf).toBe(480_000n);
  });

  it("ESI = 0 (gross 59 000 > 21 000 threshold)", () => {
    expect(r.deductions.esi).toBe(0n);
  });

  it("PT = ₹200 (20 000 paise) for gross > ₹21 000", () => {
    expect(r.deductions.pt).toBe(20_000n);
  });

  it("netPay = gross − PF − PT", () => {
    // 5 900 000 − 480 000 − 20 000 = 5 400 000
    expect(r.netPay).toBe(5_900_000n - 480_000n - 20_000n);
  });

  it("LOP = 0.0, daysPresent = 26.0", () => {
    expect(r.lopDays.toFixed(1)).toBe("0.0");
    expect(r.daysPresent.toFixed(1)).toBe("26.0");
  });
});

// ── Structure B: ₹37,000 gross — 2 LOP ─────────────────────────────────────

describe("Structure B (basic 25k + HRA 10k + conv 2k = gross 37k), 2 ABSENT LOP", () => {
  const r = computePayslip(
    { basic: "25000", hra: "10000", conveyance: "2000" },
    { absentDays: 2, halfDays: 0 },
    SLABS,
  );

  it("LOP = 2.0, daysPresent = 24.0", () => {
    expect(r.lopDays.toFixed(1)).toBe("2.0");
    expect(r.daysPresent.toFixed(1)).toBe("24.0");
  });

  it("earned basic = round_half_up(25 000 × 100 × 24/26)", () => {
    // 2 500 000 × 24 / 26 = 2 307 692.307… → round half-up = 2 307 692
    expect(r.earnings.basic).toBe(2_307_692n);
  });

  it("PF = 12% × earned basic = round_half_up(0.12 × 2 307 692) = 276 923", () => {
    // 0.12 × 2 307 692 = 276 923.04 → round half-up = 276 923
    expect(r.deductions.pf).toBe(276_923n);
  });

  it("ESI = 0 (gross after LOP still > ₹21 000 threshold)", () => {
    // earned gross = 2307692 + 923077 + 184615 ≈ 34-35 k → above threshold
    expect(r.deductions.esi).toBe(0n);
  });

  it("PT = ₹200 (gross > ₹21 000)", () => {
    expect(r.deductions.pt).toBe(20_000n);
  });
});

// ── Structure C: ₹18,300 gross — ESI applies ────────────────────────────────

describe("Structure C (basic 12k + HRA 4.8k + conv 1.5k = gross 18.3k), 0 LOP", () => {
  const r = computePayslip(
    { basic: "12000", hra: "4800", conveyance: "1500" },
    { absentDays: 0, halfDays: 0 },
    SLABS,
  );

  it("gross = 18 300 × 100 paise", () => {
    // 12000 + 4800 + 1500 = 18300 → 1 830 000 paise
    expect(r.earnings.gross).toBe(1_830_000n);
  });

  it("PF = 12% × basic = 12% × 12 000 × 100 = 144 000 paise (₹1 440)", () => {
    expect(r.deductions.pf).toBe(144_000n);
  });

  it("ESI = 0.75% × gross (gross ≤ ₹21 000) = round_half_up(0.0075 × 1 830 000) = 13 725", () => {
    // 0.0075 × 1 830 000 = 13 725 exactly
    expect(r.deductions.esi).toBe(13_725n);
  });

  it("PT = ₹0 (gross ≤ ₹21 000 → PT_NIL slab)", () => {
    expect(r.deductions.pt).toBe(0n);
  });

  it("netPay = 1 830 000 − 144 000 − 13 725 = 1 672 275", () => {
    expect(r.netPay).toBe(1_830_000n - 144_000n - 13_725n);
  });
});

// ── Half-day LOP ─────────────────────────────────────────────────────────────

describe("Half-day counts as 0.5 LOP", () => {
  const r = computePayslip(
    { basic: "40000", hra: "16000", conveyance: "3000" },
    { absentDays: 0, halfDays: 1 },
    SLABS,
  );

  it("lopDays = 0.5, daysPresent = 25.5", () => {
    expect(r.lopDays.toFixed(1)).toBe("0.5");
    expect(r.daysPresent.toFixed(1)).toBe("25.5");
  });

  it("earned basic = round_half_up(40 000 × 100 × 25.5/26)", () => {
    // 4 000 000 × 25.5 / 26 = 3 923 076.923… → round half-up = 3 923 077
    const expected = BigInt(
      new Decimal("4000000")
        .mul(new Decimal("25.5").div(26))
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toString(),
    );
    expect(r.earnings.basic).toBe(expected);
  });
});

// ── ESI threshold boundary ───────────────────────────────────────────────────

describe("ESI threshold boundary (₹21 000 = 2 100 000 paise)", () => {
  it("gross exactly at ₹21 000 → ESI applies", () => {
    // basic 14000 + hra 5600 + conv 1400 = 21000
    const r = computePayslip(
      { basic: "14000", hra: "5600", conveyance: "1400" },
      { absentDays: 0, halfDays: 0 },
      SLABS,
    );
    expect(r.earnings.gross).toBe(2_100_000n);
    expect(r.deductions.esi).toBeGreaterThan(0n);
  });

  it("gross at ₹21 001 → ESI does NOT apply", () => {
    // basic 14001 + hra 5600 + conv 1400 = 21001
    const r = computePayslip(
      { basic: "14001", hra: "5600", conveyance: "1400" },
      { absentDays: 0, halfDays: 0 },
      SLABS,
    );
    expect(r.earnings.gross).toBe(2_100_100n);
    expect(r.deductions.esi).toBe(0n);
  });
});
