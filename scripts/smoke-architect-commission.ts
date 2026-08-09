// Phase 6b smoke — architect referral → commission stamped on order
// → record payment.
//
// 1. Create fresh Architect at 8%.
// 2. Create fresh Client with architectId=that architect.
// 3. Quote → SEND → ACCEPTED → order.
// 4. Assert ArchitectCommission row: baseAmount=order.taxableAmount,
//    pct=8, amount=base*8/100.
// 5. Rate-freeze proof: bump architect to 12%, create a SECOND order,
//    confirm the FIRST commission is unchanged (still 8%) and the
//    second is 12%.
// 6. recordCommissionPayment → paidAt + paymentRef persisted.
// 7. Second record-payment attempt refused.
//
// Self-cleaning. Run: pnpm tsx scripts/smoke-architect-commission.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { createQuotation, setQuotationStatus } from "../src/modules/quotations/actions";
import { createOrderFromQuotation } from "../src/modules/orders/actions";
import {
  createArchitect, updateArchitect, recordCommissionPayment,
} from "../src/modules/architects/actions";

const created = {
  architectId:  "",
  clientId:     "",
  quoteIds:     [] as string[],
  orderIds:     [] as string[],
  commissionIds: [] as string[],
};

async function main() {
  const branch = await prisma.branch.findFirstOrThrow({ select: { id: true, orgId: true } });
  const nonM2m = await prisma.product.findFirstOrThrow({
    where: { requiresMeasurement: false, status: "ACTIVE" },
    select: { id: true },
  });

  // ── 1. Create architect ────────────────────────────────────
  const uniq = `SMOKE-ARC-${Date.now()}`;
  const arch = await createArchitect({
    code: uniq, firmName: "SMOKE Architect Firm",
    contactName: "S. Test", mobile: "+919000000042",
    commissionPct: 8,
  });
  if (!arch.ok) throw new Error(`createArchitect: ${arch.error} ${JSON.stringify(arch.fieldErrors)}`);
  created.architectId = arch.data!.id;
  console.log(`step 1 · architect created ${arch.data!.code} @ 8%`);

  // ── 2. Create referred client (direct DB — client CRUD action
  //       isn't touched by 6b; we just need a client row).
  const client = await prisma.client.create({
    data: {
      orgId: branch.orgId, name: "SMOKE Referred Client",
      type: "PROJECT", status: "ACTIVE",
      stateCode: "33", primaryMobile: "+919000000098",
      architectId: created.architectId,
    },
    select: { id: true },
  });
  created.clientId = client.id;
  console.log(`step 2 · client created with architect link`);

  // ── 3. Quote → order (first order at 8%) ────────────────────
  const firstOrder = await makeOrder(client.id, branch.id, nonM2m.id, 1000_00n, 2);
  created.quoteIds.push(firstOrder.quoteId);
  created.orderIds.push(firstOrder.orderId);
  console.log(`step 3 · first order created total=₹${Number(firstOrder.total) / 100}`);

  // ── 4. Verify commission ────────────────────────────────────
  const c1 = await prisma.architectCommission.findUniqueOrThrow({
    where:  { salesOrderId: firstOrder.orderId },
    select: { id: true, baseAmount: true, pct: true, amount: true, architectId: true },
  });
  created.commissionIds.push(c1.id);
  const so1 = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: firstOrder.orderId }, select: { taxableAmount: true },
  });
  const expected1 = BigInt(new Prisma.Decimal(so1.taxableAmount.toString()).mul(8).div(100).round().toString());
  console.log(`step 4 · commission stamped: base=₹${Number(c1.baseAmount) / 100}  pct=${c1.pct}  amount=₹${Number(c1.amount) / 100}`);
  if (c1.baseAmount !== so1.taxableAmount) throw new Error(`FAIL: baseAmount != taxableAmount`);
  if (c1.pct.toString() !== "8") throw new Error(`FAIL: pct != 8`);
  if (c1.amount !== expected1) throw new Error(`FAIL: amount ${c1.amount} != expected ${expected1}`);
  console.log(`         PASS — commission = base × 8%`);

  // ── 5. Bump rate to 12% and issue a SECOND order — first row
  //       must NOT change (freeze semantics).
  const bump = await updateArchitect({ id: created.architectId, commissionPct: 12 });
  if (!bump.ok) throw new Error(`updateArchitect: ${bump.error}`);
  const secondOrder = await makeOrder(client.id, branch.id, nonM2m.id, 500_00n, 1);
  created.quoteIds.push(secondOrder.quoteId);
  created.orderIds.push(secondOrder.orderId);
  const c1Again = await prisma.architectCommission.findUniqueOrThrow({
    where: { id: c1.id }, select: { pct: true, amount: true },
  });
  const c2 = await prisma.architectCommission.findUniqueOrThrow({
    where:  { salesOrderId: secondOrder.orderId },
    select: { id: true, pct: true, amount: true },
  });
  created.commissionIds.push(c2.id);
  console.log(`step 5 · after rate bump to 12%:`);
  console.log(`         first commission still pct=${c1Again.pct} amount=₹${Number(c1Again.amount) / 100}`);
  console.log(`         second commission pct=${c2.pct} amount=₹${Number(c2.amount) / 100}`);
  if (c1Again.pct.toString() !== "8") throw new Error(`FAIL: first commission rate mutated to ${c1Again.pct}`);
  if (c2.pct.toString() !== "12") throw new Error(`FAIL: second commission pct != 12`);
  console.log(`         PASS — freeze semantics hold across rate change`);

  // ── 6. recordCommissionPayment ──────────────────────────────
  const pay = await recordCommissionPayment({
    commissionId: c1.id,
    paymentRef:   "UPI/SMOKE/TXN123",
  });
  if (!pay.ok) throw new Error(`recordPayment: ${pay.error}`);
  const c1Paid = await prisma.architectCommission.findUniqueOrThrow({
    where: { id: c1.id }, select: { paidAt: true, paymentRef: true },
  });
  console.log(`step 6 · payment recorded: paidAt=${c1Paid.paidAt?.toISOString().slice(0, 10)}  ref=${c1Paid.paymentRef}`);
  if (c1Paid.paidAt == null) throw new Error(`FAIL: paidAt not stamped`);
  if (c1Paid.paymentRef !== "UPI/SMOKE/TXN123") throw new Error(`FAIL: paymentRef mismatch`);

  // ── 7. Second payment refused ──────────────────────────────
  const doublePay = await recordCommissionPayment({
    commissionId: c1.id, paymentRef: "duplicate",
  });
  if (doublePay.ok) throw new Error(`FAIL: double payment accepted`);
  console.log(`step 7 · double payment rejected (${doublePay.error})`);

  console.log("\nPASS — Phase 6b: architect commission stamp + freeze + payment all hold.");
}

async function makeOrder(
  clientId: string, branchId: string,
  productId: string, unitRatePaise: bigint, qty: number,
): Promise<{ quoteId: string; orderId: string; total: bigint }> {
  const draft = await createQuotation({
    clientId, branchId,
    date: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    lines: [{
      productId, description: "SMOKE line", quantity: qty,
      rate: (Number(unitRatePaise) / 100).toFixed(2),
      discountPct: 0,
    }],
  });
  if (!draft.ok) throw new Error(`quote: ${draft.error} ${JSON.stringify(draft.fieldErrors)}`);
  await setQuotationStatus({ id: draft.data!.id, status: "SENT" });
  await setQuotationStatus({ id: draft.data!.id, status: "ACCEPTED" });
  const orderRes = await createOrderFromQuotation({ quotationId: draft.data!.id });
  if (!orderRes.ok) throw new Error(`order: ${orderRes.error}`);
  const so = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: orderRes.data!.id }, select: { total: true },
  });
  return { quoteId: draft.data!.id, orderId: orderRes.data!.id, total: so.total };
}

async function cleanup() {
  try {
    for (const id of created.commissionIds) {
      try { await prisma.architectCommission.delete({ where: { id } }); } catch { /* cascaded */ }
    }
    for (const id of created.orderIds) {
      try { await prisma.salesOrder.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.quoteIds) {
      try { await prisma.quotation.delete({ where: { id } }); } catch { /* ok */ }
    }
    if (created.clientId)    await prisma.client.delete({ where: { id: created.clientId } });
    if (created.architectId) await prisma.architect.delete({ where: { id: created.architectId } });
    console.log("Cleaned up smoke rows.");
  } catch (e) {
    console.warn("cleanup partial:", (e as Error).message);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await cleanup(); await prisma.$disconnect(); });
