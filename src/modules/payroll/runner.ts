// Payroll runner — computes a monthly payslip from
//   · SalaryStructure + components (monthly paise per component)
//   · Attendance (LOP counted, everything else = paid day)
//   · StatutorySlab (PF / ESI / PT / …) for deductions
//
// Kept as a pure function `computePayslip()` so the reconciliation
// smoke can call it with hand-fixtured inputs and compare against
// the same math done manually. The tx-wrapping action lives in
// ./actions.ts.
//
// §14 Phase 7 gate: "run payroll for 10 employees across 3
// structures → reconcile every line against a manual calculation."
//
// Conventions:
//   - SalaryComponent.amount is MONTHLY paise (BigInt).
//   - `daysWorked` count from Attendance:
//       PRESENT / LATE / LEAVE / HOLIDAY / WEEK_OFF → 1 day
//       HALF_DAY → 0.5 day
//       ABSENT → 0 day (loss of pay)
//   - workedRatio = daysWorked / daysInMonth (Decimal).
//   - prorated component = round(amount × workedRatio) per line
//     (round half-up to nearest paisa). Round PER LINE so the
//     sum stays deterministic under any rearrangement.
//   - Deductions:
//       PF = round(BASIC_component × ratio × employeeRate).
//         BASIC identified by SalaryComponent.name === "BASIC".
//         No ceiling for 7a (real cap is ₹15,000 basic; deferred).
//       ESI = round(gross × employeeRate) IF gross ≤ ESI toAmount.
//       PT = flat slab lookup by gross (uses flatAmount).
//   - net = gross − Σ deductions.

import { Prisma } from "@/kernel/numbering/series";

// ── Pure data shapes ────────────────────────────────────────────

export interface PayrollComponent {
  name:      string;      // BASIC | HRA | SPECIAL | …
  amount:    bigint;      // monthly paise
  isEarning: boolean;
}
export interface AttendanceRoll {
  present:  number;       // status ∈ PRESENT | LATE
  halfDay:  number;
  leave:    number;
  holiday:  number;
  weekOff:  number;
  absent:   number;
}
export interface StatSlab {
  kind:         string;                  // "PF" | "ESI" | "PT_TN"
  fromAmount:   bigint;
  toAmount:     bigint | null;
  employeeRate: number | null;           // as fraction, e.g. 0.12
  employerRate: number | null;
  flatAmount:   bigint | null;
}
export interface ComputeInputs {
  components:  readonly PayrollComponent[];
  attendance:  AttendanceRoll;
  daysInMonth: number;
  slabs:       readonly StatSlab[];
}
export interface PayslipResult {
  daysWorked:   number;     // decimal number
  daysLOP:      number;
  gross:        bigint;
  deductions:   bigint;
  net:          bigint;
  breakup:      Record<string, bigint>;   // component name → paise
  deductionMap: Record<string, bigint>;   // PF | ESI | PT | …
}

// ── The single formula, used by BOTH the runner and the smoke ─
export function computePayslip(inp: ComputeInputs): PayslipResult {
  const daysWorked =
    inp.attendance.present +
    inp.attendance.halfDay * 0.5 +
    inp.attendance.leave +
    inp.attendance.holiday +
    inp.attendance.weekOff;
  const daysLOP = inp.attendance.absent;

  // workedRatio kept as Decimal for exact per-line pro-ration.
  const workedRatio = new Prisma.Decimal(daysWorked).div(inp.daysInMonth);

  const breakup: Record<string, bigint> = {};
  let gross = 0n;
  let basicComponent = 0n;
  for (const c of inp.components) {
    if (!c.isEarning) continue;
    // amount × ratio, rounded to nearest paisa. Prisma.Decimal
    // handles the multiplication exactly; convert to bigint at
    // the end via toFixed(0) so half-up is Postgres-style.
    const prorated = new Prisma.Decimal(c.amount.toString()).mul(workedRatio);
    const paise = BigInt(prorated.toFixed(0));
    breakup[c.name] = paise;
    gross += paise;
    if (c.name === "BASIC") basicComponent = paise;
  }

  // ── Statutory deductions ────────────────────────────────────
  const deductionMap: Record<string, bigint> = {};

  const pfSlab = pickPfSlab(inp.slabs);
  if (pfSlab?.employeeRate != null) {
    const pf = new Prisma.Decimal(basicComponent.toString()).mul(pfSlab.employeeRate);
    deductionMap["PF"] = BigInt(pf.toFixed(0));
  }

  const esiSlab = pickEsiSlab(inp.slabs);
  if (esiSlab?.employeeRate != null && esiSlab.toAmount != null && gross <= esiSlab.toAmount) {
    const esi = new Prisma.Decimal(gross.toString()).mul(esiSlab.employeeRate);
    deductionMap["ESI"] = BigInt(esi.toFixed(0));
  }

  const ptSlab = pickPtSlab(inp.slabs, gross);
  if (ptSlab?.flatAmount != null && ptSlab.flatAmount > 0n) {
    deductionMap["PT"] = ptSlab.flatAmount;
  }

  let deductions = 0n;
  for (const v of Object.values(deductionMap)) deductions += v;

  return {
    daysWorked, daysLOP,
    gross, deductions,
    net: gross - deductions,
    breakup, deductionMap,
  };
}

// ── Slab pickers (pure) ─────────────────────────────────────────

function pickPfSlab(slabs: readonly StatSlab[]): StatSlab | undefined {
  return slabs.find((s) => s.kind === "PF");
}
function pickEsiSlab(slabs: readonly StatSlab[]): StatSlab | undefined {
  return slabs.find((s) => s.kind === "ESI");
}
/**
 * TN professional tax is a stepped MONTHLY slab. Seed writes slabs
 * as bigint paise from/to values keyed by (annual? monthly?) —
 * looking at the seed's numbers (2_100_000 = ₹21,000) it's monthly
 * gross. flatAmount 13_500 = ₹135 = monthly PT for the ₹21,000–
 * ₹30,000 bucket.
 */
function pickPtSlab(slabs: readonly StatSlab[], gross: bigint): StatSlab | undefined {
  const cands = slabs.filter((s) => s.kind === "PT_TN");
  for (const s of cands) {
    const hit = gross >= s.fromAmount && (s.toAmount == null || gross < s.toAmount);
    if (hit) return s;
  }
  return undefined;
}

// ── Attendance rollup helper (also pure) ────────────────────────
export function rollAttendance(
  rows: readonly { status: string }[],
): AttendanceRoll {
  const r: AttendanceRoll = {
    present: 0, halfDay: 0, leave: 0, holiday: 0, weekOff: 0, absent: 0,
  };
  for (const a of rows) {
    switch (a.status) {
      case "PRESENT": case "LATE": r.present  += 1; break;
      case "HALF_DAY":              r.halfDay  += 1; break;
      case "LEAVE":                 r.leave    += 1; break;
      case "HOLIDAY":               r.holiday  += 1; break;
      case "WEEK_OFF":              r.weekOff  += 1; break;
      case "ABSENT":                r.absent   += 1; break;
    }
  }
  return r;
}
