"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { allocateReceiptToInvoice } from "@/kernel/accounts/allocate";
import { computeOutstanding } from "@/kernel/money/outstanding";
import { devContext } from "@/lib/dev-context";
import { checkGateForReceipt } from "@/modules/projects/advance-gate";
import { createReceiptSchema, bounceReceiptSchema, clearChequeSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createReceipt(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; unallocated: bigint }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.create");

  const parsed = createReceiptSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const totalPaise = BigInt(d.amount);
  if (totalPaise <= 0n) {
    return { ok: false, error: "Validation failed", fieldErrors: { amount: "Amount must be > 0" } };
  }

  const db = scoped(ctx);

  // Fetch branch just for the invoice number prefix
  const branch = await db.branch.findUnique({
    where: { id: d.branchId },
    select: { invoicePrefix: true },
  });
  if (!branch) return { ok: false, error: "Branch not found." };

  // Parse and validate allocation pairs
  const allocationPairs = d.allocations.map((a) => ({
    invoiceId: a.invoiceId,
    amount:    BigInt(a.amount),
  }));
  const allocatedTotal = allocationPairs.reduce((s, a) => s + a.amount, 0n);
  if (allocatedTotal > totalPaise) {
    return {
      ok: false,
      error: `Allocated total (${allocatedTotal}) exceeds receipt amount (${totalPaise})`,
    };
  }
  const unallocated = totalPaise - allocatedTotal;

  // Pre-tx outstanding check (non-locking — the kernel does the FOR UPDATE)
  if (allocationPairs.length > 0) {
    const fieldErrors: Record<string, string> = {};
    const invoiceIds = allocationPairs.map((a) => a.invoiceId);
    const invs = await db.invoice.findMany({
      where: { id: { in: invoiceIds } },
      select: { id: true, number: true, total: true, advanceAdjusted: true, clientId: true, status: true },
    });
    const allocationSums = await db.receiptAllocation.groupBy({
      by: ["invoiceId"],
      where: { invoiceId: { in: invoiceIds } },
      _sum: { amount: true },
    });
    const paidMap = new Map(allocationSums.map((a) => [a.invoiceId, a._sum.amount ?? 0n]));
    const invMap  = new Map(invs.map((i) => [i.id, i]));

    for (const p of allocationPairs) {
      const inv = invMap.get(p.invoiceId);
      if (!inv) { fieldErrors[`alloc_${p.invoiceId}`] = "Invoice not found"; continue; }
      if (inv.clientId !== d.clientId) {
        fieldErrors[`alloc_${p.invoiceId}`] = `Invoice ${inv.number} belongs to another client`;
        continue;
      }
      if (inv.status === "CANCELLED" || inv.status === "PAID") {
        fieldErrors[`alloc_${p.invoiceId}`] = `Invoice ${inv.number} is ${inv.status}`;
        continue;
      }
      const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, paidMap.get(p.invoiceId) ?? 0n);
      if (p.amount > outstanding) {
        fieldErrors[`alloc_${p.invoiceId}`] =
          `Over-allocated: only ${outstanding} paise outstanding on ${inv.number}`;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "Validation failed", fieldErrors };
    }
  }

  const receiptDate = new Date(d.date);
  const yymm        = yymmFromDate(receiptDate);

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:  ctx.orgId,
      series: "RCT",
      yymm,
      prefix: branch.invoicePrefix,
    });

    const receipt = await tx.receipt.create({
      data: {
        organizationId: ctx.orgId,
        number,
        clientId:    d.clientId,
        projectId:   d.projectId ?? null,
        date:        receiptDate,
        mode:        d.mode,
        reference:   (d.reference ?? "").trim() || null,
        chequeDate:  d.chequeDate ? new Date(d.chequeDate) : null,
        chequeStatus: d.mode === "CHEQUE" ? "PENDING" : null,
        amount:      totalPaise,
        unallocated,
      },
      select: { id: true, number: true },
    });

    // Allocate to each invoice using the kernel (FOR UPDATE per invoice)
    for (const p of allocationPairs) {
      await allocateReceiptToInvoice(tx, {
        receiptId:      receipt.id,
        invoiceId:      p.invoiceId,
        amount:         p.amount,
        organizationId: ctx.orgId,
      });
    }

    // Update invoice statuses after allocation
    for (const p of allocationPairs) {
      const allSum = await tx.receiptAllocation.aggregate({
        where: { invoiceId: p.invoiceId },
        _sum:  { amount: true },
      });
      const inv = await tx.invoice.findUniqueOrThrow({
        where: { id: p.invoiceId },
        select: { total: true, advanceAdjusted: true, status: true },
      });
      const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allSum._sum.amount ?? 0n);
      const nextStatus  = outstanding <= 0n ? "PAID" : "PARTIALLY_PAID";
      if (nextStatus !== inv.status) {
        await tx.invoice.update({ where: { id: p.invoiceId }, data: { status: nextStatus } });
      }
    }

    return receipt;
  }, { orgId: ctx.orgId });

  // Advance-gate: derive projects from allocated invoices (PaymentSheet
  // doesn't pass projectId), move them to Installation when the required
  // advance is met. Best-effort; runs outside the tx.
  const gated = await checkGateForReceipt(db, {
    receiptProjectId: d.projectId ?? null,
    invoiceIds:       allocationPairs.map((a) => a.invoiceId),
  });
  for (const pid of gated) revalidatePath(`/projects/${pid}`);

  revalidatePath("/receipts");
  revalidatePath("/invoicing");
  revalidatePath(`/clients/${d.clientId}`);
  return { ok: true, data: { ...created, unallocated } };
}

export async function bounceReceipt(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.reverse");

  const parsed = bounceReceiptSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db  = scoped(ctx);
  const row = await db.receipt.findUnique({
    where: { id },
    select: {
      id: true, number: true, chequeStatus: true, amount: true,
      allocations: { select: { id: true, invoiceId: true, amount: true } },
    },
  });
  if (!row) return { ok: false, error: "Receipt not found." };
  if (row.chequeStatus === "BOUNCED") return { ok: false, error: "Already bounced." };
  if (row.chequeStatus !== "PENDING") {
    return { ok: false, error: "Only PENDING cheques can be bounced." };
  }

  await withTransaction(async (tx: TxClient) => {
    // Lock affected invoices, then delete allocations
    const invoiceIds = [...new Set(row.allocations.map((a) => a.invoiceId))];
    if (invoiceIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM "Invoice"
        WHERE id = ANY(${invoiceIds}::text[])
        FOR UPDATE
      `;
    }

    // Delete all ReceiptAllocations for this receipt
    if (row.allocations.length > 0) {
      await tx.receiptAllocation.deleteMany({
        where: { receiptId: id },
      });
    }

    // Mark receipt as bounced, restore unallocated to full amount
    await tx.receipt.update({
      where: { id },
      data: { chequeStatus: "BOUNCED", unallocated: row.amount },
    });

    // Recompute invoice statuses — outstanding restores automatically (computed)
    for (const invId of invoiceIds) {
      const allSum = await tx.receiptAllocation.aggregate({
        where: { invoiceId: invId },
        _sum:  { amount: true },
      });
      const inv = await tx.invoice.findUniqueOrThrow({
        where: { id: invId },
        select: { total: true, advanceAdjusted: true, status: true },
      });
      const outstanding = computeOutstanding(inv.total, inv.advanceAdjusted, allSum._sum.amount ?? 0n);
      const nextStatus  = outstanding <= 0n ? "PAID"
        : (allSum._sum.amount ?? 0n) > 0n   ? "PARTIALLY_PAID"
        :                                      "ISSUED";
      if (nextStatus !== inv.status) {
        await tx.invoice.update({ where: { id: invId }, data: { status: nextStatus } });
      }
    }
  }, { orgId: ctx.orgId });

  revalidatePath("/receipts");
  revalidatePath("/invoicing");
  return { ok: true, data: { id } };
}

export async function clearCheque(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "receipt.reverse");

  const parsed = clearChequeSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id } = parsed.data;

  const db  = scoped(ctx);
  const row = await db.receipt.findUnique({
    where:  { id },
    select: { id: true, chequeStatus: true },
  });
  if (!row) return { ok: false, error: "Receipt not found." };
  if (row.chequeStatus === "CLEARED")  return { ok: false, error: "Already cleared." };
  if (row.chequeStatus !== "PENDING") {
    return { ok: false, error: "Only PENDING cheques can be marked cleared." };
  }

  await db.receipt.update({
    where: { id },
    data:  { chequeStatus: "CLEARED" },
  });

  revalidatePath("/receipts");
  revalidatePath("/accounts");
  return { ok: true, data: { id } };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}
