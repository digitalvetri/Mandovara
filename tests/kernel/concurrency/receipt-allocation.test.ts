// Session 6 gate — parallel receipt allocations against the same invoice
// NEVER over-allocate. Invoice total ₹10,000. 5 receipts of ₹5,000 each,
// all attempt to allocate their full amount against the same invoice.
// Max allocatable = ₹10,000 = 2 successful full allocations. The rest
// must fail with OverAllocationError. Sum of allocations must equal the
// invoice total exactly.

import { beforeAll, describe, expect, it } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { allocateReceiptToInvoice, OverAllocationError } from "@/kernel/accounts/allocate";
import { setupTwoTenants, type Tenant } from "../fixtures";
let A: Tenant;
let invoiceId: string;
const receiptIds: string[] = [];
const INVOICE_TOTAL = 1_000_000n; // ₹10,000 in paise
const RECEIPT_AMOUNT = 500_000n;  // ₹5,000 in paise
const N_RECEIPTS = 5;

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  const client = await db.client.create({
    data: {
      orgId: A.orgId, name: "Alloc client", type: "DEALER", stateCode: "33",
      primaryMobile: "+919999888877",
    },
  });
  const inv = await db.invoice.create({
    data: {
      orgId: A.orgId, branchId: A.branchId, type: "TAX", clientId: client.id,
      number: "INV-ALLOC-1", date: new Date(), dueDate: new Date(Date.now() + 30 * 864e5),
      placeOfSupply: "33",
      taxableAmount: INVOICE_TOTAL, cgst: 0n, sgst: 0n, igst: 0n, roundOff: 0n,
      total: INVOICE_TOTAL, status: "ISSUED",
    },
  });
  invoiceId = inv.id;
  for (let i = 0; i < N_RECEIPTS; i++) {
    const r = await db.receipt.create({
      data: {
        orgId: A.orgId, branchId: A.branchId, clientId: client.id,
        number: `RC-${i}`, date: new Date(), mode: "UPI", amount: RECEIPT_AMOUNT,
      },
    });
    receiptIds.push(r.id);
  }
});

describe("receipt allocation — parallel never over-allocates", () => {
  it(`invoice ₹10,000; ${N_RECEIPTS} × ₹5,000 receipts try to allocate; total stays ≤ ₹10,000`, async () => {
    const results = await Promise.allSettled(
      receiptIds.map((rid) =>
        db.$transaction(
          async (tx) => {
            await allocateReceiptToInvoice(tx, {
              receiptId: rid, invoiceId, amount: RECEIPT_AMOUNT,
            });
          },
          { maxWait: 60_000, timeout: 60_000 },
        ),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed    = results.filter((r) => r.status === "rejected");

    // Every failure must be OverAllocationError.
    for (const r of failed) {
      if (r.status !== "rejected") continue;
      expect(r.reason).toBeInstanceOf(OverAllocationError);
    }

    // ₹10,000 total / ₹5,000 each = exactly 2 receipts fit.
    expect(succeeded).toBe(2);
    expect(failed.length).toBe(N_RECEIPTS - 2);

    // Sum of allocations = invoice total exactly, never over.
    const sum = await db.receiptAllocation.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    });
    const total = sum._sum.amount ?? 0n;
    expect(total).toBe(INVOICE_TOTAL);
  }, 90_000);
});
