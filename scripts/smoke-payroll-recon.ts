// §14 Phase 7 gate — "run payroll for 10 employees across 3
// structures → reconcile every line against a manual calculation."
//
// Seeds 10 fresh employees across 3 CTC tiers, seeds a controlled
// month of attendance (varied full-month / 2-LOP / 5-LOP), then
// runs payroll and asserts each payslip line matches a manual
// calculation done independently here in the smoke.
//
// Then proves the month-lock: finalizePayrollRun → markPunch on
// a day in the locked month is refused.
//
// Self-cleaning. Run: pnpm tsx scripts/smoke-payroll-recon.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { devContext } from "../src/lib/dev-context";
import { runPayroll, finalizePayrollRun } from "../src/modules/payroll/actions";
import { markPunch } from "../src/modules/attendance/actions";

const created = {
  employeeIds:  [] as string[],
  structureIds: [] as string[],
  payrollRunId: "",
};

const MONTH = 7;   // July — chosen for 31 days
const YEAR  = 2027; // Fresh year no seed can touch

interface Structure {
  label:    string;
  basic:    bigint;
  hra:      bigint;
  special:  bigint;
  gross:    bigint;  // sum of earnings
}
const STRUCTURES: Structure[] = [
  {
    label:   "STR-A",
    basic:   20_000_00n, hra: 8_000_00n, special: 2_000_00n,
    gross:   30_000_00n,
  },
  {
    label:   "STR-B",
    basic:   35_000_00n, hra: 14_000_00n, special: 6_000_00n,
    gross:   55_000_00n,
  },
  {
    label:   "STR-C",
    basic:   50_000_00n, hra: 20_000_00n, special: 10_000_00n,
    gross:   80_000_00n,
  },
];

interface EmpSpec {
  code:      string;
  structure: Structure;
  lopDays:   number;
}
// 10 employees across 3 structures, mix of LOP profiles.
const EMPS: EmpSpec[] = [
  { code: "R-A1", structure: STRUCTURES[0]!, lopDays: 0 },
  { code: "R-A2", structure: STRUCTURES[0]!, lopDays: 2 },
  { code: "R-A3", structure: STRUCTURES[0]!, lopDays: 5 },
  { code: "R-B1", structure: STRUCTURES[1]!, lopDays: 0 },
  { code: "R-B2", structure: STRUCTURES[1]!, lopDays: 2 },
  { code: "R-B3", structure: STRUCTURES[1]!, lopDays: 5 },
  { code: "R-C1", structure: STRUCTURES[2]!, lopDays: 0 },
  { code: "R-C2", structure: STRUCTURES[2]!, lopDays: 2 },
  { code: "R-C3", structure: STRUCTURES[2]!, lopDays: 5 },
  { code: "R-A4", structure: STRUCTURES[0]!, lopDays: 1 },
];

async function main() {
  await devContext();   // priming dev-context; server actions call it internally
  const branch = await prisma.branch.findFirstOrThrow({ select: { id: true, orgId: true } });
  const daysInMonth = new Date(YEAR, MONTH, 0).getDate();   // 31
  console.log(`fixture · branch=${branch.id}  month=${MONTH}/${YEAR}  daysInMonth=${daysInMonth}`);

  // ── Seed employees + structures ────────────────────────────
  const uniq = Date.now();
  for (const spec of EMPS) {
    const emp = await prisma.employee.create({
      data: {
        orgId:   branch.orgId,
        branchId: branch.id,
        code:    `${spec.code}-${uniq}`,
        name:    `SMOKE ${spec.code}`,
        mobile:  `+91${9000000000 + created.employeeIds.length}`,
        joinDate: new Date(2025, 0, 1),
        status:  "ACTIVE",
      },
      select: { id: true },
    });
    created.employeeIds.push(emp.id);
    const structure = await prisma.salaryStructure.create({
      data: {
        orgId:         branch.orgId,
        employeeId:    emp.id,
        effectiveFrom: new Date(2025, 3, 1),
        ctc:           spec.structure.gross * 12n,
        components: {
          create: [
            { name: "BASIC",   amount: spec.structure.basic,   isEarning: true, ordering: 1 },
            { name: "HRA",     amount: spec.structure.hra,     isEarning: true, ordering: 2 },
            { name: "SPECIAL", amount: spec.structure.special, isEarning: true, ordering: 3 },
          ],
        },
      },
      select: { id: true },
    });
    created.structureIds.push(structure.id);

    // Seed attendance for the month: daysInMonth − lopDays PRESENT,
    // then lopDays ABSENT at the tail.
    const rows: { orgId: string; employeeId: string; date: Date; status: "ABSENT" | "PRESENT" }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(YEAR, MONTH - 1, d));
      const isLop = d > daysInMonth - spec.lopDays;
      rows.push({
        orgId: branch.orgId, employeeId: emp.id,
        date,
        status: isLop ? "ABSENT" : "PRESENT",
      });
    }
    await prisma.attendance.createMany({ data: rows });
  }
  console.log(`seeded 10 employees, ${daysInMonth * 10} attendance rows`);

  // ── Run payroll ─────────────────────────────────────────────
  const run = await runPayroll({ branchId: branch.id, month: MONTH, year: YEAR });
  if (!run.ok) throw new Error(`runPayroll: ${run.error}`);
  created.payrollRunId = run.data!.payrollRunId;
  console.log(`ran payroll: id=${run.data!.payrollRunId}  count=${run.data!.count}  totalPayable=${run.data!.totalPayable}`);

  // ── Manual reconciliation per employee ─────────────────────
  const slabs = await prisma.statutorySlab.findMany({
    select: { kind: true, fromAmount: true, toAmount: true,
              employeeRate: true, employerRate: true, flatAmount: true },
  });
  function pfRate(): number {
    const pf = slabs.find((s) => s.kind === "PF");
    return pf?.employeeRate == null ? 0 : Number(pf.employeeRate);
  }
  function esiRateIfEligible(gross: bigint): number {
    const esi = slabs.find((s) => s.kind === "ESI");
    if (!esi?.employeeRate || esi.toAmount == null) return 0;
    return gross <= esi.toAmount ? Number(esi.employeeRate) : 0;
  }
  function ptFor(gross: bigint): bigint {
    const cands = slabs.filter((s) => s.kind === "PT_TN");
    for (const s of cands) {
      const hit = gross >= s.fromAmount && (s.toAmount == null || gross < s.toAmount);
      if (hit) return s.flatAmount ?? 0n;
    }
    return 0n;
  }
  function roundPaise(dec: Prisma.Decimal): bigint {
    return BigInt(dec.toFixed(0));
  }
  interface Expected {
    employeeId: string; label: string;
    workedRatio: string; gross: bigint; deductions: bigint; net: bigint;
    breakdown: { basic: bigint; hra: bigint; special: bigint;
                 pf: bigint; esi: bigint; pt: bigint };
  }
  const expectedByEmp = new Map<string, Expected>();
  for (let i = 0; i < EMPS.length; i++) {
    const spec = EMPS[i]!;
    const empId = created.employeeIds[i]!;
    const daysWorked = daysInMonth - spec.lopDays;
    const workedRatio = new Prisma.Decimal(daysWorked).div(daysInMonth);
    const basic   = roundPaise(new Prisma.Decimal(spec.structure.basic.toString()).mul(workedRatio));
    const hra     = roundPaise(new Prisma.Decimal(spec.structure.hra.toString()).mul(workedRatio));
    const special = roundPaise(new Prisma.Decimal(spec.structure.special.toString()).mul(workedRatio));
    const gross   = basic + hra + special;
    const pf      = roundPaise(new Prisma.Decimal(basic.toString()).mul(pfRate()));
    const esi     = roundPaise(new Prisma.Decimal(gross.toString()).mul(esiRateIfEligible(gross)));
    const pt      = ptFor(gross);
    const deductions = pf + esi + pt;
    const net = gross - deductions;
    expectedByEmp.set(empId, {
      employeeId: empId, label: spec.code,
      workedRatio: workedRatio.toString(),
      gross, deductions, net,
      breakdown: { basic, hra, special, pf, esi, pt },
    });
  }

  // ── Load payslips and compare line-by-line ─────────────────
  // The runner processes every ACTIVE employee with a structure —
  // filter to only the 10 fresh employees this smoke seeded.
  const payslips = await prisma.payslip.findMany({
    where: {
      payrollRunId: created.payrollRunId,
      employeeId:   { in: created.employeeIds },
    },
    select: { employeeId: true, gross: true, deductions: true, net: true, breakup: true,
              daysWorked: true, daysLOP: true },
  });
  console.log(`\n${"emp".padEnd(6)} ${"gross".padStart(10)} ${"pf".padStart(8)} ${"esi".padStart(7)} ${"pt".padStart(6)} ${"net".padStart(10)}   ok`);
  let failed = 0;
  for (const p of payslips) {
    const exp = expectedByEmp.get(p.employeeId);
    if (!exp) { console.log(`  no expected for employeeId=${p.employeeId}`); failed++; continue; }
    const breakup = p.breakup as Record<string, string>;
    const okGross = p.gross === exp.gross;
    const okDeductions = p.deductions === exp.deductions;
    const okNet = p.net === exp.net;
    const okBasic = BigInt(breakup["BASIC"] ?? "0") === exp.breakdown.basic;
    const okHra   = BigInt(breakup["HRA"]   ?? "0") === exp.breakdown.hra;
    const okPf    = BigInt(breakup["PF"]    ?? "0") === exp.breakdown.pf;
    const okEsi   = BigInt(breakup["ESI"]   ?? "0") === exp.breakdown.esi;
    const okPt    = BigInt(breakup["PT"]    ?? "0") === exp.breakdown.pt;
    const allOk = okGross && okDeductions && okNet && okBasic && okHra && okPf && okEsi && okPt;
    if (!allOk) failed++;
    const mark = allOk ? "✓" : "✗";
    console.log(
      `${exp.label.padEnd(6)} ${(Number(p.gross)/100).toFixed(2).padStart(10)} ` +
      `${(Number(breakup["PF"] ?? "0")/100).toFixed(2).padStart(8)} ` +
      `${(Number(breakup["ESI"] ?? "0")/100).toFixed(2).padStart(7)} ` +
      `${(Number(breakup["PT"] ?? "0")/100).toFixed(2).padStart(6)} ` +
      `${(Number(p.net)/100).toFixed(2).padStart(10)}    ${mark}`,
    );
    if (!allOk) {
      console.log(`  expected: gross=${exp.gross} deductions=${exp.deductions} net=${exp.net}`);
      console.log(`  breakup:  ${JSON.stringify({
        BASIC: breakup["BASIC"], HRA: breakup["HRA"], SPECIAL: breakup["SPECIAL"],
        PF: breakup["PF"], ESI: breakup["ESI"], PT: breakup["PT"],
      })}`);
      console.log(`  expected: BASIC=${exp.breakdown.basic} HRA=${exp.breakdown.hra} SPECIAL=${exp.breakdown.special} PF=${exp.breakdown.pf} ESI=${exp.breakdown.esi} PT=${exp.breakdown.pt}`);
    }
  }
  if (failed > 0) throw new Error(`FAIL: ${failed} payslip line(s) failed reconciliation`);

  // ── Prove finalize + month-lock ────────────────────────────
  console.log("\n──────── month-lock ──────────");
  // Precondition: markPunch on a day in July 2027 works BEFORE finalize.
  const beforeLock = await markPunch({
    employeeId: created.employeeIds[0]!,
    date: `${YEAR}-${String(MONTH).padStart(2, "0")}-15`,
    status: "PRESENT",
  });
  if (!beforeLock.ok) throw new Error(`FAIL: markPunch pre-finalize refused: ${beforeLock.error}`);
  console.log(`before finalize: markPunch on ${YEAR}-${MONTH}-15 → ok`);

  const fin = await finalizePayrollRun({ payrollRunId: created.payrollRunId });
  if (!fin.ok) throw new Error(`finalizePayrollRun: ${fin.error}`);
  console.log(`finalized run ${created.payrollRunId} → ${fin.data!.status}`);

  // Now the same markPunch must be refused.
  const afterLock = await markPunch({
    employeeId: created.employeeIds[0]!,
    date: `${YEAR}-${String(MONTH).padStart(2, "0")}-15`,
    status: "PRESENT",
  });
  if (afterLock.ok) throw new Error(`FAIL: markPunch after finalize NOT refused`);
  console.log(`after finalize: markPunch refused (${afterLock.error})`);

  // A different month must still accept punches.
  const nextMonth = await markPunch({
    employeeId: created.employeeIds[0]!,
    date: `${YEAR}-${String(MONTH + 1).padStart(2, "0")}-01`,
    status: "PRESENT",
  });
  if (!nextMonth.ok) throw new Error(`FAIL: lock leaked to next month: ${nextMonth.error}`);
  console.log(`next month punch still ok`);

  // Re-run refused now.
  const rerun = await runPayroll({ branchId: branch.id, month: MONTH, year: YEAR });
  if (rerun.ok) throw new Error(`FAIL: runPayroll accepted after finalize`);
  console.log(`re-run refused (${rerun.error})`);

  console.log("\nPASS — §14 Phase 7 gate: 10 employees × 3 structures reconciled to paisa; month-lock enforced.");
}

async function cleanup() {
  try {
    if (created.payrollRunId) {
      try { await prisma.payrollRun.delete({ where: { id: created.payrollRunId } }); } catch { /* ok */ }
    }
    for (const id of created.employeeIds) {
      try { await prisma.attendance.deleteMany({ where: { employeeId: id } }); } catch { /* ok */ }
      try { await prisma.salaryStructure.deleteMany({ where: { employeeId: id } }); } catch { /* ok */ }
      try { await prisma.employee.delete({ where: { id } }); } catch { /* ok */ }
    }
    console.log("Cleaned up smoke rows.");
  } catch (e) {
    console.warn("cleanup partial:", (e as Error).message);
  }
}

void Prisma;
main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
