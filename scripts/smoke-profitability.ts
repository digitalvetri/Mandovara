// §14 Phase 6 gate #4 — profitability reconciles to stock + expense
// ledgers to the paisa.
//
// Seeds a fresh project with:
//   · 3 MaterialIssue rows (varied qty × rate, all positive)
//   · 1 MaterialIssue with NEGATIVE qty (schema convention for
//     reversal per line 1636)
//   · 2 APPROVED ProjectExpense rows
//   · 1 SUBMITTED ProjectExpense row (must be EXCLUDED)
//
// Then computes profitability via the module and cross-checks the
// two reconciled totals against direct prisma.aggregate calls done
// a different way. Asserts strict === on bigints.
//
// Run: pnpm tsx scripts/smoke-profitability.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { devContext } from "../src/lib/dev-context";
import {
  computeProjectProfitability, sumMaterialCost, sumApprovedExpenses,
} from "../src/modules/reports/profitability";

const created = {
  projectId:    "",
  materialIds:  [] as string[],
  expenseIds:   [] as string[],
};

async function main() {
  const ctx = await devContext();
  const client = await prisma.client.findFirstOrThrow({
    where: { status: "ACTIVE" }, select: { id: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({ select: { id: true, orgId: true } });
  const product = await prisma.product.findFirstOrThrow({
    where: { status: "ACTIVE" }, select: { id: true },
  });

  // ── Seed project ────────────────────────────────────────────
  const proj = await prisma.project.create({
    data: {
      orgId:      branch.orgId,
      branchId:   branch.id,
      number:     `SMOKE/PROJ/${Date.now()}`,
      name:       "SMOKE profitability",
      clientId:   client.id,
      startDate:  new Date(Date.now() - 30 * 864e5),
      status:     "ACTIVE",
      orderValue: 0n,
    },
    select: { id: true },
  });
  created.projectId = proj.id;
  console.log(`fixture · project=${proj.id}`);

  // Row 1: 10 × ₹100 = ₹1,000
  // Row 2: 5.5 × ₹200 = ₹1,100
  // Row 3: 3 × ₹50 = ₹150
  // Row 4: -2 × ₹100 = -₹200 (REVERSAL)
  // Expected materialCost = 1000 + 1100 + 150 − 200 = ₹2,050 = 205000 paise.
  const issues = [
    { quantity: "10.0000",  rate: 100_00n,   label: "10 × ₹100" },
    { quantity: "5.5000",   rate: 200_00n,   label: "5.5 × ₹200" },
    { quantity: "3.0000",   rate: 50_00n,    label: "3 × ₹50" },
    { quantity: "-2.0000",  rate: 100_00n,   label: "-2 × ₹100 (reversal)" },
  ];
  for (const iss of issues) {
    const row = await prisma.materialIssue.create({
      data: {
        orgId:      branch.orgId,
        projectId:  proj.id,
        productId:  product.id,
        quantity:   new Prisma.Decimal(iss.quantity),
        rate:       iss.rate,
        issuedAt:   new Date(),
      }, select: { id: true },
    });
    created.materialIds.push(row.id);
    console.log(`  MaterialIssue ${iss.label}`);
  }
  const expectedMaterial = 205_000n;

  // 2 APPROVED (₹500 + ₹1,200 = ₹1,700 = 170000 paise counted)
  // 1 SUBMITTED (₹3,000 — must be excluded)
  const expenses = [
    { amount: 500_00n,  status: "APPROVED" as const, category: "TRANSPORT", label: "APPROVED ₹500" },
    { amount: 1200_00n, status: "APPROVED" as const, category: "SUPPLIES",  label: "APPROVED ₹1,200" },
    { amount: 3000_00n, status: "SUBMITTED" as const, category: "MISC",     label: "SUBMITTED ₹3,000 (excluded)" },
  ];
  for (const e of expenses) {
    const row = await prisma.projectExpense.create({
      data: {
        orgId:     branch.orgId,
        projectId: proj.id,
        category:  e.category,
        amount:    e.amount,
        status:    e.status,
        spentAt:   new Date(),
      }, select: { id: true },
    });
    created.expenseIds.push(row.id);
    console.log(`  ProjectExpense ${e.label}`);
  }
  const expectedExpenses = 170_000n;

  // ── Compute via the module ─────────────────────────────────
  const p = await computeProjectProfitability(ctx, proj.id);
  if (!p) throw new Error("computeProjectProfitability returned null");
  console.log("");
  console.log("via computeProjectProfitability:");
  console.log(`  materialCost = ${p.materialCost} paise = ₹${Number(p.materialCost) / 100}`);
  console.log(`  expenses     = ${p.expenses} paise = ₹${Number(p.expenses) / 100}`);
  console.log(`  revenue      = ${p.revenue} paise (heuristic)`);
  console.log(`  commissions  = ${p.commissions} paise (heuristic)`);
  console.log(`  netMargin    = ${p.netMargin} paise`);

  // Cross-check 1: helper
  const mHelper = await sumMaterialCost(ctx, proj.id);
  // Cross-check 2: raw ORM + Decimal math
  const rows = await prisma.materialIssue.findMany({
    where:  { projectId: proj.id },
    select: { quantity: true, rate: true },
  });
  let mManual = 0n;
  for (const r of rows) {
    const dot = new Prisma.Decimal(r.rate.toString()).mul(r.quantity);
    mManual += BigInt(dot.round().toString());
  }
  console.log(`\nreconciliation · materialCost:`);
  console.log(`  module      = ${p.materialCost}`);
  console.log(`  sumHelper   = ${mHelper}`);
  console.log(`  manualOrm   = ${mManual}`);
  console.log(`  expected    = ${expectedMaterial}`);
  if (p.materialCost !== expectedMaterial) throw new Error(`FAIL: module material != expected`);
  if (mHelper !== expectedMaterial) throw new Error(`FAIL: helper material != expected`);
  if (mManual !== expectedMaterial) throw new Error(`FAIL: manualOrm material != expected`);

  const eHelper = await sumApprovedExpenses(ctx, proj.id);
  const eAgg = await prisma.projectExpense.aggregate({
    where: { projectId: proj.id, status: "APPROVED" },
    _sum:  { amount: true },
  });
  const eAggVal = eAgg._sum.amount ?? 0n;
  console.log(`\nreconciliation · expenses:`);
  console.log(`  module      = ${p.expenses}`);
  console.log(`  sumHelper   = ${eHelper}`);
  console.log(`  rawAgg      = ${eAggVal}`);
  console.log(`  expected    = ${expectedExpenses}`);
  if (p.expenses !== expectedExpenses) throw new Error(`FAIL: module expenses != expected`);
  if (eHelper !== expectedExpenses) throw new Error(`FAIL: helper expenses != expected`);
  if (eAggVal !== expectedExpenses) throw new Error(`FAIL: rawAgg expenses != expected`);

  console.log("\nPASS — profitability reconciles to stock + expense ledgers to the paisa.");
}

async function cleanup() {
  try {
    for (const id of created.materialIds) {
      try { await prisma.materialIssue.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.expenseIds) {
      try { await prisma.projectExpense.delete({ where: { id } }); } catch { /* ok */ }
    }
    if (created.projectId) await prisma.project.delete({ where: { id: created.projectId } });
    console.log("Cleaned up smoke rows.");
  } catch (e) {
    console.warn("cleanup partial:", (e as Error).message);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
