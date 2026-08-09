// Phase 6a end-to-end smoke covering the three §14 gate flows:
//
//   1. Advance auto-adjust on invoice creation (task #29).
//      Seed a ₹500 open Advance for a client, invoice a ₹2,000 order,
//      confirm ₹500 came off the invoice via Invoice.advanceAdjusted
//      and the Advance flipped to FULLY_ADJUSTED.
//
//   2. Multi-invoice receipt with residual (§14 gate #2, task #30).
//      Create three fresh invoices, one receipt paying two fully +
//      partial on the third with cash left over, verify residual +
//      each invoice's status.
//
//   3. Cheque bounce restores outstanding (§14 gate #3, task #28).
//      Fresh invoice, receipt via cheque covering it → invoice PAID.
//      Bounce the cheque, invoice restored to ISSUED, outstanding
//      = original total.
//
// Self-cleaning. Run: pnpm tsx scripts/smoke-phase6-money.ts

import { Prisma } from "@prisma/client";
import { prisma } from "../src/kernel/db/client";
import { createOrderFromQuotation } from "../src/modules/orders/actions";
import { createQuotation, setQuotationStatus } from "../src/modules/quotations/actions";
import { createInvoiceFromOrder } from "../src/modules/invoices/actions";
import { createReceipt, bounceReceipt } from "../src/modules/receipts/actions";

type Created = {
  orderIds:   string[];
  quoteIds:   string[];
  invoiceIds: string[];
  receiptIds: string[];
  advanceIds: string[];
};
const created: Created = { orderIds: [], quoteIds: [], invoiceIds: [], receiptIds: [], advanceIds: [] };

// Minimal helper — creates a fresh order for the given client and returns its id + total.
async function makeOrder(
  clientId: string, branchId: string,
  productId: string, unitRatePaise: bigint, qty: number,
): Promise<{ orderId: string; total: bigint; quoteId: string }> {
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
  if (!draft.ok) throw new Error(`createQuotation: ${draft.error} ${JSON.stringify(draft.fieldErrors)}`);
  await setQuotationStatus({ id: draft.data!.id, status: "SENT" });
  await setQuotationStatus({ id: draft.data!.id, status: "ACCEPTED" });
  const orderRes = await createOrderFromQuotation({ quotationId: draft.data!.id });
  if (!orderRes.ok) throw new Error(`createOrder: ${orderRes.error}`);
  const so = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: orderRes.data!.id }, select: { total: true },
  });
  return { orderId: orderRes.data!.id, total: so.total, quoteId: draft.data!.id };
}

async function main() {
  const client = await prisma.client.findFirstOrThrow({
    where: { status: "ACTIVE" }, select: { id: true, name: true },
  });
  const branch = await prisma.branch.findFirstOrThrow({ select: { id: true } });
  const nonM2m = await prisma.product.findFirstOrThrow({
    where: { requiresMeasurement: false, status: "ACTIVE" },
    select: { id: true },
  });
  console.log(`fixture: client=${client.name}`);

  // ── FLOW 1 · ADVANCE AUTO-ADJUST ─────────────────────────────
  console.log("\n─── FLOW 1: advance auto-adjust ───");
  const advanceAmount = 500_00n;   // ₹500
  const advance = await prisma.advance.create({
    data: {
      orgId:    (await prisma.branch.findUniqueOrThrow({ where: { id: branch.id }, select: { orgId: true } })).orgId,
      branchId: branch.id,
      number:   `SMOKE/ADV/${Date.now()}`,
      clientId: client.id,
      amount:   advanceAmount,
      status:   "OPEN",
      receivedAt: new Date(),
    },
    select: { id: true },
  });
  created.advanceIds.push(advance.id);
  console.log(`step 1a · seeded advance ₹500 (id=${advance.id})`);

  const { orderId: order1, total: order1Total, quoteId: quote1 } =
    await makeOrder(client.id, branch.id, nonM2m.id, 1000_00n, 2);   // ₹2,000
  created.orderIds.push(order1); created.quoteIds.push(quote1);
  console.log(`step 1b · order created total=₹${Number(order1Total) / 100}`);

  const invRes1 = await createInvoiceFromOrder({
    salesOrderId: order1, type: "TAX",
    date: new Date().toISOString().slice(0, 10),
  });
  if (!invRes1.ok) throw new Error(`invoice: ${invRes1.error}`);
  created.invoiceIds.push(invRes1.data!.id);

  const inv1 = await prisma.invoice.findUniqueOrThrow({
    where: { id: invRes1.data!.id },
    select: { total: true, advanceAdjusted: true, status: true, number: true },
  });
  const adv1 = await prisma.advance.findUniqueOrThrow({
    where: { id: advance.id }, select: { adjusted: true, status: true },
  });
  console.log(`step 1c · invoice ${inv1.number}: total=₹${Number(inv1.total) / 100}  advanceAdjusted=₹${Number(inv1.advanceAdjusted) / 100}  status=${inv1.status}`);
  console.log(`         advance now: adjusted=₹${Number(adv1.adjusted) / 100}  status=${adv1.status}`);
  if (inv1.advanceAdjusted !== advanceAmount) throw new Error(`FAIL: advanceAdjusted expected ₹500 got ₹${Number(inv1.advanceAdjusted) / 100}`);
  if (adv1.status !== "FULLY_ADJUSTED") throw new Error(`FAIL: advance status expected FULLY_ADJUSTED got ${adv1.status}`);
  console.log("         PASS — advance drained onto invoice");

  // ── FLOW 2 · MULTI-INVOICE RECEIPT + RESIDUAL ────────────────
  console.log("\n─── FLOW 2: multi-invoice receipt with residual ───");
  // Three ₹1,000 orders → three ₹1,180 invoices (₹1,000 + 18% GST if 18% product).
  // Rather than assume GST rate, use rate=₹1,000 and read back total.
  const invs: { id: string; total: bigint; number: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const { orderId, quoteId } = await makeOrder(client.id, branch.id, nonM2m.id, 1000_00n, 1);
    created.orderIds.push(orderId); created.quoteIds.push(quoteId);
    const iRes = await createInvoiceFromOrder({
      salesOrderId: orderId, type: "TAX",
      date: new Date().toISOString().slice(0, 10),
    });
    if (!iRes.ok) throw new Error(`invoice ${i}: ${iRes.error}`);
    created.invoiceIds.push(iRes.data!.id);
    const inv = await prisma.invoice.findUniqueOrThrow({
      where: { id: iRes.data!.id }, select: { id: true, total: true, number: true },
    });
    invs.push(inv);
    console.log(`step 2${String.fromCharCode(97 + i)} · invoice ${inv.number} total=₹${Number(inv.total) / 100}`);
  }
  // Receipt = full(inv0) + full(inv1) + half(inv2) + ₹100 residual.
  const halfInv2 = invs[2]!.total / 2n;
  const receiptAmt = invs[0]!.total + invs[1]!.total + halfInv2 + 100_00n;
  const rcpt = await createReceipt({
    clientId: client.id, branchId: branch.id,
    date: new Date().toISOString().slice(0, 10),
    mode: "CASH",
    amount: (Number(receiptAmt) / 100).toFixed(2),
    allocations: [
      { invoiceId: invs[0]!.id, amount: (Number(invs[0]!.total) / 100).toFixed(2) },
      { invoiceId: invs[1]!.id, amount: (Number(invs[1]!.total) / 100).toFixed(2) },
      { invoiceId: invs[2]!.id, amount: (Number(halfInv2) / 100).toFixed(2) },
    ],
  });
  if (!rcpt.ok) throw new Error(`createReceipt: ${rcpt.error}`);
  created.receiptIds.push(rcpt.data!.id);
  console.log(`step 2d · receipt created ₹${Number(receiptAmt) / 100}  unallocated=₹${Number(rcpt.data!.unallocated) / 100}`);
  if (rcpt.data!.unallocated !== 100_00n) throw new Error(`FAIL: residual expected ₹100 got ₹${Number(rcpt.data!.unallocated) / 100}`);

  const statuses = await Promise.all(invs.map((i) =>
    prisma.invoice.findUniqueOrThrow({ where: { id: i.id }, select: { status: true } }),
  ));
  const [i0, i1, i2] = statuses as [typeof statuses[0], typeof statuses[0], typeof statuses[0]];
  console.log(`step 2e · invoice statuses: [${i0.status}, ${i1.status}, ${i2.status}]`);
  if (i0.status !== "PAID" || i1.status !== "PAID" || i2.status !== "PARTIALLY_PAID") {
    throw new Error(`FAIL: expected [PAID, PAID, PARTIALLY_PAID]`);
  }
  console.log("         PASS — three invoices settled with residual");

  // ── FLOW 3 · CHEQUE BOUNCE ──────────────────────────────────
  console.log("\n─── FLOW 3: cheque bounce restores outstanding ───");
  const { orderId: order3, quoteId: quote3 } = await makeOrder(client.id, branch.id, nonM2m.id, 500_00n, 1);
  created.orderIds.push(order3); created.quoteIds.push(quote3);
  const iRes3 = await createInvoiceFromOrder({
    salesOrderId: order3, type: "TAX",
    date: new Date().toISOString().slice(0, 10),
  });
  if (!iRes3.ok) throw new Error(`invoice: ${iRes3.error}`);
  created.invoiceIds.push(iRes3.data!.id);
  const inv3 = await prisma.invoice.findUniqueOrThrow({
    where: { id: iRes3.data!.id }, select: { total: true, number: true },
  });
  console.log(`step 3a · invoice ${inv3.number} total=₹${Number(inv3.total) / 100}`);

  const chq = await createReceipt({
    clientId: client.id, branchId: branch.id,
    date: new Date().toISOString().slice(0, 10),
    mode: "CHEQUE",
    reference: "CHQ-SMOKE-001",
    amount: (Number(inv3.total) / 100).toFixed(2),
    allocations: [{
      invoiceId: iRes3.data!.id,
      amount: (Number(inv3.total) / 100).toFixed(2),
    }],
  });
  if (!chq.ok) throw new Error(`chequeReceipt: ${chq.error}`);
  created.receiptIds.push(chq.data!.id);
  const inv3Paid = await prisma.invoice.findUniqueOrThrow({
    where: { id: iRes3.data!.id }, select: { status: true },
  });
  console.log(`step 3b · cheque receipt ${chq.data!.number}, invoice status=${inv3Paid.status}`);
  if (inv3Paid.status !== "PAID") throw new Error(`FAIL: expected PAID, got ${inv3Paid.status}`);

  const bounce = await bounceReceipt({
    receiptId: chq.data!.id,
    reason: "cheque bounced — insufficient funds",
  });
  if (!bounce.ok) throw new Error(`bounce: ${bounce.error}`);
  console.log(`step 3c · bounced ${chq.data!.number}, ${bounce.data!.affectedInvoices.length} invoice(s) affected`);

  const inv3Reverted = await prisma.invoice.findUniqueOrThrow({
    where: { id: iRes3.data!.id }, select: { status: true },
  });
  const rcptAfter = await prisma.receipt.findUniqueOrThrow({
    where: { id: chq.data!.id },
    select: { chequeStatus: true, unallocated: true, allocations: { select: { id: true } } },
  });
  console.log(`step 3d · after bounce: invoice status=${inv3Reverted.status}  cheque=${rcptAfter.chequeStatus}  unallocated=₹${Number(rcptAfter.unallocated) / 100}  allocations=${rcptAfter.allocations.length}`);
  if (inv3Reverted.status !== "ISSUED") throw new Error(`FAIL: expected ISSUED, got ${inv3Reverted.status}`);
  if (rcptAfter.chequeStatus !== "BOUNCED") throw new Error(`FAIL: expected chequeStatus BOUNCED`);
  if (rcptAfter.allocations.length !== 0) throw new Error(`FAIL: expected zero allocations`);
  if (rcptAfter.unallocated !== 0n) throw new Error(`FAIL: expected unallocated=0`);
  console.log("         PASS — cheque bounced, invoice restored, allocations released");

  // Second bounce must be idempotent-rejected (already BOUNCED).
  const doubleBounce = await bounceReceipt({
    receiptId: chq.data!.id, reason: "trying again",
  });
  if (doubleBounce.ok) throw new Error("FAIL: double-bounce should be rejected");
  console.log(`step 3e · second bounce rejected (${doubleBounce.error})`);

  console.log("\nPASS — Phase 6a smoke: advance-adjust + multi-invoice residual + cheque bounce all hold.");
}

async function cleanup() {
  try {
    // Order matters: allocations cascade from receipt, but invoice
    // has FK from allocations too — drop receipts first, then
    // invoices, then orders, then quotes.
    for (const id of created.receiptIds) {
      try { await prisma.receipt.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.invoiceIds) {
      try { await prisma.invoice.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.orderIds) {
      try { await prisma.salesOrder.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.quoteIds) {
      try { await prisma.quotation.delete({ where: { id } }); } catch { /* ok */ }
    }
    for (const id of created.advanceIds) {
      try { await prisma.advance.delete({ where: { id } }); } catch { /* ok */ }
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
