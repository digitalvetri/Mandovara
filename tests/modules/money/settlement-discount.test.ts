// Settlement discount on a project — the client closes the account for
// less than the quote (owner, 2026-09-18).
//
// Asserted on the figures every screen reads, not on the column: after the
// discount the job owes nothing and reads as settled; the invoice raised
// afterwards bills the discounted amount, so once the payments are swept
// onto it nothing is left outstanding on the bill either.

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma as db } from "@/kernel/db/client";
import { setupTwoTenants, type Tenant } from "../../kernel/fixtures";
import { computeLineTax } from "@/kernel/tax/gst";

let A: Tenant;
const ctxRef: { current: unknown } = { current: null };
vi.mock("@/lib/dev-context", () => ({ devContext: async () => ctxRef.current }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { setProjectDiscount, clearProjectDiscount } = await import("@/modules/projects/actions-discount");
const { createInvoiceFromQuotation } = await import("@/modules/invoices/actions-from-quotation");
const { createManualInvoice } = await import("@/modules/invoices/actions-manual");
const { createInvoiceFromOrder } = await import("@/modules/invoices/actions-part2");
const { spreadDiscount, rateForTaxable } = await import("@/kernel/money/settlement");
const { getProjectReceivable } = await import("@/modules/projects/receivable");
const { getProjectLedger } = await import("@/modules/projects/queries-ledger");
const rdb = db as unknown as Parameters<typeof getProjectReceivable>[0];

function rand(): string { return Math.random().toString(36).slice(2, 8); }

function withPerms(...extra: string[]) {
  ctxRef.current = { ...A.ctx, permissions: new Set([...A.ctx.permissions, ...extra]) };
}

/** Quoted ₹1,05,410 (two lines, 18 % GST, intra-state), ₹98,000 received. */
async function makeJob(received = 9_800_000n) {
  const client = await db.client.create({
    data: {
      organizationId: A.orgId, code: `CLI-${rand()}`, name: "Settle Client",
      mobile: `+9198${Math.floor(10000000 + Math.random() * 89999999)}`, billingAddress: {},
    },
    select: { id: true },
  });
  const project = await db.project.create({
    data: {
      organizationId: A.orgId, branchId: A.branchId, number: `MDV/PRJ-${rand()}`,
      name: "Settle Project", clientId: client.id, ownerId: A.userId, stage: "ORDERED", siteAddress: {},
    },
    select: { id: true },
  });
  // Two 18 % lines, intra-state, taxed the way the app taxes them:
  // ₹70,800.00 + ₹34,610.00 = ₹1,05,410.00.
  const line = (taxable: bigint) => {
    const t = computeLineTax({ taxable, gstRate: 18, supplierStateCode: "33", placeOfSupplyCode: "33" });
    return { taxable, cgst: t.cgst, sgst: t.sgst };
  };
  const l1 = line(6_000_000n);
  const l2 = line(2_933_051n);
  const total = l1.taxable + l1.cgst + l1.sgst + l2.taxable + l2.cgst + l2.sgst;
  const quote = await db.quotation.create({
    data: {
      organizationId: A.orgId, branchId: A.branchId, number: `MDV/QT-${rand()}`,
      projectId: project.id, clientId: client.id, ownerId: A.userId,
      date: new Date(), validUntil: new Date(Date.now() + 86_400_000), status: "ACCEPTED",
      taxableAmount: l1.taxable + l2.taxable, cgst: l1.cgst + l2.cgst, sgst: l1.sgst + l2.sgst,
      igst: 0n, roundOff: 0n, total,
      lines: {
        create: [
          { organizationId: A.orgId, lineNo: 1, description: "Curtains", quantity: 1, unit: "PIECE",
            rate: l1.taxable, taxable: l1.taxable, gstRate: 18, cgst: l1.cgst, sgst: l1.sgst, igst: 0n,
            amount: l1.taxable + l1.cgst + l1.sgst },
          { organizationId: A.orgId, lineNo: 2, description: "Blinds", quantity: 1, unit: "PIECE",
            rate: l2.taxable, taxable: l2.taxable, gstRate: 18, cgst: l2.cgst, sgst: l2.sgst, igst: 0n,
            amount: l2.taxable + l2.cgst + l2.sgst },
        ],
      },
    },
    select: { id: true, total: true },
  });
  if (received > 0n) {
    await db.receipt.create({
      data: {
        organizationId: A.orgId, number: `RCT-${rand()}`, clientId: client.id, projectId: project.id,
        date: new Date(), mode: "CASH", amount: received, unallocated: received,
      },
    });
  }
  return {
    projectId: project.id, clientId: client.id, quoteId: quote.id, total: quote.total,
    lines: [l1, l2],
  };
}

beforeAll(async () => {
  const t = await setupTwoTenants(db);
  A = t.A;
  await db.branch.update({ where: { id: A.branchId }, data: { stateCode: "33", invoicePrefix: "MDV" } });
});

beforeEach(async () => {
  withPerms("project.discount", "project.view", "invoice.create", "quotation.approve");
  await db.receiptAllocation.deleteMany({});
  await db.receipt.deleteMany({});
  await db.invoiceLine.deleteMany({});
  await db.invoice.deleteMany({});
  await db.orderLine.deleteMany({});
  await db.order.deleteMany({});
  await db.quotationLine.deleteMany({});
  await db.quotation.deleteMany({});
  await db.project.deleteMany({});
  await db.client.deleteMany({});
});

describe("settlement discount", () => {
  it("closes the account: nothing left to collect, and the job reads as settled", async () => {
    const { projectId, total } = await makeJob();
    expect(total).toBe(10_541_000n);
    expect((await getProjectReceivable(rdb, projectId))?.due).toBe(741_000n);

    const res = await setProjectDiscount({ projectId, amount: "7,410", reason: "Final settlement" });
    expect(res.ok).toBe(true);

    const r = await getProjectReceivable(rdb, projectId);
    expect(r?.agreedValue).toBe(10_541_000n); // Quoted is still the quote
    expect(r?.discount).toBe(741_000n);
    expect(r?.received).toBe(9_800_000n);     // a discount is not money in
    expect(r?.due).toBe(0n);
    expect(r?.credit).toBe(0n);
    expect(r?.settled).toBe(true);
  });

  it("shows on the ledger as its own row, and the running balance ends at zero", async () => {
    const { projectId } = await makeJob();
    await setProjectDiscount({ projectId, amount: "7410", reason: "Final settlement" });

    const ledger = await getProjectLedger(ctxRef.current as never, projectId);
    const row = ledger.rows.find((x) => x.kind === "DISCOUNT");
    expect(row?.credit).toBe(741_000n);
    expect(row?.note).toBe("Final settlement");
    expect(ledger.rows.at(-1)?.balance).toBe(0n);
    expect(ledger.balance).toBe(0n);
  });

  it("can settle part of what is left", async () => {
    const { projectId } = await makeJob();
    await setProjectDiscount({ projectId, amount: "410", reason: "Rounded down" });
    expect((await getProjectReceivable(rdb, projectId))?.due).toBe(700_000n);
  });

  it("refuses more than is still to collect", async () => {
    const { projectId } = await makeJob();
    const res = await setProjectDiscount({ projectId, amount: "7411", reason: "Too much" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/more than what is still to collect/);
    expect((await getProjectReceivable(rdb, projectId))?.discount).toBe(0n);
  });

  it("needs a reason", async () => {
    const { projectId } = await makeJob();
    const res = await setProjectDiscount({ projectId, amount: "100", reason: "" });
    expect(res.ok).toBe(false);
  });

  it("can be taken back", async () => {
    const { projectId } = await makeJob();
    await setProjectDiscount({ projectId, amount: "7410", reason: "Final settlement" });
    expect((await clearProjectDiscount({ projectId })).ok).toBe(true);

    const r = await getProjectReceivable(rdb, projectId);
    expect(r?.discount).toBe(0n);
    expect(r?.due).toBe(741_000n);
  });

  it("writes an audit row for both giving and taking back", async () => {
    const { projectId } = await makeJob();
    await setProjectDiscount({ projectId, amount: "7410", reason: "Final settlement" });
    await clearProjectDiscount({ projectId });
    const actions = (await db.auditLog.findMany({
      where: { entityType: "Project", entityId: projectId }, select: { action: true },
    })).map((a) => a.action);
    expect(actions).toContain("SETTLEMENT_DISCOUNT_SET");
    expect(actions).toContain("SETTLEMENT_DISCOUNT_CLEAR");
  });

  it("is refused without project.discount — the server checks, not just the button", async () => {
    const { projectId } = await makeJob();
    withPerms("project.view", "invoice.create");
    await expect(setProjectDiscount({ projectId, amount: "100", reason: "Nope" })).rejects.toThrow();
  });

  it("bills the discounted amount, and the bill is paid in full once swept", async () => {
    const { projectId, quoteId } = await makeJob();
    await setProjectDiscount({ projectId, amount: "7410", reason: "Final settlement" });

    const inv = await createInvoiceFromQuotation({ quotationId: quoteId });
    expect(inv.error ?? null).toBeNull();
    expect(inv.ok).toBe(true);

    const row = await db.invoice.findUniqueOrThrow({ where: { id: inv.data!.id }, select: { total: true } });
    expect(row.total).toBe(9_800_000n);

    const r = await getProjectReceivable(rdb, projectId);
    expect(r?.invoiceDue).toBe(0n);
    expect(r?.due).toBe(0n);
  });

  it("the invoice builder's seeded rates bill the discounted amount too", async () => {
    // The path the Create invoice button actually takes: /invoicing/create
    // seeds each rate from spreadDiscount → rateForTaxable, and the builder
    // posts them to createManualInvoice. Built here the same way.
    const { projectId, lines } = await makeJob();
    await setProjectDiscount({ projectId, amount: "7410", reason: "Final settlement" });

    const spread = spreadDiscount(lines.map((l) => ({ taxable: l.taxable, gstRate: 18 })), 741_000n);
    const rupees = (p: bigint) => `${p / 100n}.${(p % 100n).toString().padStart(2, "0")}`;
    const today  = new Date().toISOString().slice(0, 10);

    const inv = await createManualInvoice({
      projectId, date: today, dueDate: today,
      lines: spread.map((t, i) => ({
        description: `Line ${i + 1}`, unit: "PIECE", quantity: "1",
        rate: rupees(rateForTaxable(t, 1, 0)), gstRate: 18, discountPct: "0",
      })),
    });
    expect(inv.error ?? null).toBeNull();

    const row = await db.invoice.findUniqueOrThrow({ where: { id: inv.data!.id }, select: { total: true } });
    expect(row.total).toBe(9_800_000n);
    expect((await getProjectReceivable(rdb, projectId))?.due).toBe(0n);
  });

  it("an invoice raised from an order bills the discounted amount too", async () => {
    const { projectId, clientId, lines } = await makeJob();
    const order = await db.order.create({
      data: {
        organizationId: A.orgId, branchId: A.branchId, number: `ORD-${rand()}`,
        projectId, clientId, date: new Date(), totalValue: 10_541_000n, status: "CONFIRMED",
        lines: {
          create: lines.map((l, i) => ({
            organizationId: A.orgId, lineNo: i + 1, description: `Line ${i + 1}`,
            quantity: 1, unit: "PIECE" as const, rate: l.taxable, amount: l.taxable + l.cgst + l.sgst,
          })),
        },
      },
      select: { id: true },
    });
    await setProjectDiscount({ projectId, amount: "7410", reason: "Final settlement" });

    const inv = await createInvoiceFromOrder({ salesOrderId: order.id });
    expect(inv.error ?? null).toBeNull();

    const row = await db.invoice.findUniqueOrThrow({ where: { id: inv.data!.id }, select: { total: true } });
    expect(row.total).toBe(9_800_000n);
    expect((await getProjectReceivable(rdb, projectId))?.due).toBe(0n);
  });

  it("refuses once the job has been billed — that is a credit note", async () => {
    const { projectId, quoteId } = await makeJob(10_541_000n);
    const inv = await createInvoiceFromQuotation({ quotationId: quoteId });
    expect(inv.error ?? null).toBeNull();

    const res = await setProjectDiscount({ projectId, amount: "100", reason: "Too late" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/credit note/);
  });
});
