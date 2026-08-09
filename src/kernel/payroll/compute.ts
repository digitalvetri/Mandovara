/**
 * Pure payroll computation kernel.
 *
 * Reads statutory rates from StatutorySlab rows — never hardcodes PF %, ESI %, PT.
 * Money is BigInt paise throughout.
 * Salary structure components are monthly rupee amounts stored as strings in the
 * Employee.salaryStructure JSON (seed convention: { basic: "35000", hra: "14000", … }).
 *
 * LOP denominator: 26 working days (Indian standard for monthly-rated staff).
 * HALF_DAY = 0.5 LOP day. ABSENT = 1 LOP day.
 * LEAVE / HOLIDAY / WEEK_OFF = 0 LOP.
 */

import { Decimal } from "@prisma/client/runtime/library";

// ── Input types ──────────────────────────────────────────────────────────────

export interface SalaryStructure {
  basic: string;        // monthly rupees as string, e.g. "35000"
  hra: string;          // monthly rupees as string
  conveyance?: string;  // monthly rupees as string
  other?: string;       // monthly rupees as string
}

export interface AttendanceSummary {
  absentDays: number;  // count of ABSENT records in the month
  halfDays:   number;  // count of HALF_DAY records in the month
}

export interface StatutorySlabInput {
  kind:        string;        // "PF" | "ESI_EE" | "ESI_EMP" | "PT"
  fromAmount:  bigint;        // lower bound in paise (inclusive)
  toAmount:    bigint | null; // upper bound in paise (inclusive); null = unbounded
  rate:        Decimal | null; // percentage, e.g. Decimal("12.000")
  flatAmount:  bigint | null; // fixed paise amount, e.g. 20000n (₹200)
}

// ── Output types ─────────────────────────────────────────────────────────────

export interface EarningsResult {
  basic:      bigint;
  hra:        bigint;
  conveyance: bigint;
  other:      bigint;
  gross:      bigint;
}

export interface DeductionsResult {
  pf:    bigint;
  esi:   bigint;
  pt:    bigint;
  total: bigint;
}

export interface ComputedPayslip {
  daysPresent: Decimal;        // Decimal(4,1) — stored on Payslip
  lopDays:     Decimal;        // Decimal(4,1)
  otHours:     Decimal;        // always 0 in this version
  earnings:    EarningsResult;
  deductions:  DeductionsResult;
  netPay:      bigint;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Default denominator for monthly-rated employees in Indian payroll. */
export const DEFAULT_WORKING_DAYS = 26;

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Compute a single employee's payslip for a given month.
 *
 * @param structure   Salary components from Employee.salaryStructure JSON.
 * @param attendance  Absent/half-day counts from locked Attendance rows for the month.
 * @param slabs       All active StatutorySlab rows for this org — PF, ESI_EE, PT at minimum.
 * @param workingDays Calendar working days in the month (default 26).
 */
export function computePayslip(
  structure:    SalaryStructure,
  attendance:   AttendanceSummary,
  slabs:        StatutorySlabInput[],
  workingDays:  number = DEFAULT_WORKING_DAYS,
): ComputedPayslip {
  // ── 1. Parse monthly salary components (rupees → paise) ────────────────────
  const basicMonthly = BigInt(structure.basic)              * 100n;
  const hraMonthly   = BigInt(structure.hra)                * 100n;
  const convMonthly  = BigInt(structure.conveyance ?? "0")  * 100n;
  const otherMonthly = BigInt(structure.other ?? "0")       * 100n;

  // ── 2. LOP and earned-day factor ───────────────────────────────────────────
  const lopFloat   = attendance.absentDays + attendance.halfDays * 0.5;
  const lopDays    = new Decimal(lopFloat).toDecimalPlaces(1);
  const earnedDays = Math.max(0, workingDays - lopFloat);
  const factor     = new Decimal(earnedDays).div(workingDays);
  const daysPresent = new Decimal(earnedDays).toDecimalPlaces(1);

  // ── 3. Earned components (each rounded half-up to nearest paise) ───────────
  const basic      = roundHalfUp(new Decimal(basicMonthly.toString()).mul(factor));
  const hra        = roundHalfUp(new Decimal(hraMonthly.toString()).mul(factor));
  const conveyance = roundHalfUp(new Decimal(convMonthly.toString()).mul(factor));
  const other      = roundHalfUp(new Decimal(otherMonthly.toString()).mul(factor));
  const gross      = basic + hra + conveyance + other;

  // ── 4. PF employee contribution — on earned basic ──────────────────────────
  const pfSlab = slabs.find((s) => s.kind === "PF");
  const pf     = pfSlab?.rate
    ? roundHalfUp(new Decimal(basic.toString()).mul(pfSlab.rate).div(100))
    : 0n;

  // ── 5. ESI employee contribution — 0.75 % of gross if gross ≤ threshold ───
  const esiSlab = slabs.find(
    (s) => s.kind === "ESI_EE" &&
           gross <= (s.toAmount ?? BigInt(Number.MAX_SAFE_INTEGER)),
  );
  const esi = esiSlab?.rate
    ? roundHalfUp(new Decimal(gross.toString()).mul(esiSlab.rate).div(100))
    : 0n;

  // ── 6. PT — highest-tier flat amount that matches gross ────────────────────
  const ptSlab = [...slabs]
    .filter(
      (s) =>
        s.kind === "PT" &&
        gross >= s.fromAmount &&
        (s.toAmount == null || gross <= s.toAmount),
    )
    .sort((a, b) => Number(b.fromAmount - a.fromAmount)) // highest tier wins
    .at(0);
  const pt = ptSlab?.flatAmount ?? 0n;

  // ── 7. Net pay ─────────────────────────────────────────────────────────────
  const totalDeductions = pf + esi + pt;
  const netPay          = gross - totalDeductions;

  return {
    daysPresent,
    lopDays,
    otHours:    new Decimal(0),
    earnings:   { basic, hra, conveyance, other, gross },
    deductions: { pf, esi, pt, total: totalDeductions },
    netPay,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundHalfUp(d: Decimal): bigint {
  return BigInt(d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString());
}
