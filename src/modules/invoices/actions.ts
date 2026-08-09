"use server";

// Invoicing server actions.
//
// createFromOrder:
//   - Loads order + its lines and client + supplier branch stateCode
//   - Inside a transaction: allocates INV number, creates the Invoice with
//     GST breakdown copied from the order (already computed correctly by the
//     quotation stage), creates InvoiceLine rows mirroring OrderLines
//   - Client's state → placeOfSupply. IRN status defaults to NOT_REQUIRED
//     (Session 8 backend wires the real GSP-async workflow); we mark PENDING
//     if org GSTIN is set + total ≥ B2B threshold — flagged via a comment.
//
// cancelInvoice:
//   - Blocks after 24h (§11 acceptance); returns a message pointing at the
//     credit-note flow for such cases. Credit-note module is a follow-up.

import type { z } from "zod";
import { revalidatePath } from "next/cache";

// safeRevalidate — mirrors modules/quotations/actions.ts. Lets the
// action run under both a Next request and a bare tsx smoke.
function safeRevalidate(path: string): void {
  try { revalidatePath(path); } catch { /* not in a Next request */ }
}
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { createFromOrderSchema, cancelInvoiceSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const CANCEL_WINDOW_HOURS = 24;

export async function createInvoiceFromOrder(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const parsed = createFromOrderSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { salesOrderId, type, date, dueDate } = parsed.data;

  const db = scoped(ctx);
  const order = await db.salesOrder.findUniqueOrThrow({
    where: { id: salesOrderId },
    select: {
      id: true, branchId: true, clientId: true, status: true,
      taxableAmount: true, cgst: true, sgst: true, igst: true, total: true,
      lines: {
        orderBy: { lineNo: "asc" },
        select: {
          lineNo: true, productId: true, description: true,
          orderedQty: true, rate: true, gstRate: true, amount: true,
        },
      },
    },
  });
  if (order.status === "CANCELLED") {
    return { ok: false, error: "Cannot invoice a cancelled order." };
  }
  const client = await db.client.findUniqueOrThrow({
    where: { id: order.clientId },
    select: { stateCode: true, paymentTerms: true, primaryMobile: true },
  });
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: order.branchId },
    select: { invoicePrefix: true, stateCode: true },
  });

  const now = new Date();
  const invoiceDate = date ? new Date(date) : now;
  const computedDue = dueDate
    ? new Date(dueDate)
    : addDays(invoiceDate, client.paymentTerms);

  // Per-line GST split proportional to the order line's taxable share.
  // We compute per-line CGST/SGST/IGST/taxable from the order's totals so the
  // invoice ledger is complete (kernel/tax already ran at the quotation → order
  // stage; we preserve those numbers here).
  const perLineTaxable = order.lines.map((l) => {
    // taxable = amount / (1 + gstRate/100). Round to nearest paisa.
    const g = new Prisma.Decimal(l.gstRate).div(100);
    const one = new Prisma.Decimal(1);
    const taxable = new Prisma.Decimal(l.amount.toString()).div(one.plus(g));
    return BigInt(taxable.round().toString());
  });

  // Build line rows preserving the intra/inter-state split from the order header.
  const isIntra = order.igst === 0n;
  const perLineCgst: bigint[] = [];
  const perLineSgst: bigint[] = [];
  const perLineIgst: bigint[] = [];
  for (let i = 0; i < order.lines.length; i++) {
    const taxable = perLineTaxable[i]!;
    const gstRate = Number(order.lines[i]!.gstRate);
    const gstTotal = (taxable * BigInt(Math.round(gstRate * 100))) / 10_000n;
    if (isIntra) {
      const c = gstTotal / 2n;
      perLineCgst.push(c);
      perLineSgst.push(gstTotal - c);
      perLineIgst.push(0n);
    } else {
      perLineCgst.push(0n);
      perLineSgst.push(0n);
      perLineIgst.push(gstTotal);
    }
  }

  // Round-off is preserved from the order header — the sum of line amounts
  // matches order.total (order was rounded once already).
  const roundOff =
    order.total - (order.taxableAmount + order.cgst + order.sgst + order.igst);

  // §14 Phase 6 — advance auto-adjust. Pull the client's open
  // advances in FIFO order (oldest first) and consume from them
  // until either the invoice is fully offset or the pool is empty.
  // Done outside the tx as a peek; the actual writes happen inside
  // the tx below where we re-lock each row to avoid races with
  // parallel invoice creations for the same client.
  const openAdvances = await db.advance.findMany({
    where: {
      clientId: order.clientId,
      status:   { in: ["OPEN", "PARTIALLY_ADJUSTED"] },
    },
    orderBy: { receivedAt: "asc" },
    select:  { id: true, amount: true, adjusted: true },
  });

  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      order.branchId,
      docType:       "INVOICE",
      financialYear: financialYear(invoiceDate),
      prefix:        `${branch.invoicePrefix}/INV`,
    });
    // Re-lock and drain each advance under the tx so parallel invoice
    // creations for the same client can't double-consume the same
    // advance. FIFO consumption up to the invoice total.
    let remaining = order.total;
    let advanceAdjusted = 0n;
    const adjustedPerAdvance: { id: string; delta: bigint; newAdjusted: bigint; newStatus: string }[] = [];
    for (const a of openAdvances) {
      if (remaining === 0n) break;
      const locked = await tx.$queryRaw<{
        id: string; amount: string; adjusted: string; status: string;
      }[]>`
        SELECT id, amount::text, adjusted::text, status::text
          FROM "Advance" WHERE id = ${a.id} FOR UPDATE
      `;
      const cur = locked[0];
      if (!cur) continue;
      if (cur.status !== "OPEN" && cur.status !== "PARTIALLY_ADJUSTED") continue;
      const available = BigInt(cur.amount) - BigInt(cur.adjusted);
      if (available <= 0n) continue;
      const take = available < remaining ? available : remaining;
      const newAdjusted = BigInt(cur.adjusted) + take;
      const fullyAbsorbed = newAdjusted >= BigInt(cur.amount);
      const newStatus = fullyAbsorbed ? "FULLY_ADJUSTED" : "PARTIALLY_ADJUSTED";
      await tx.advance.update({
        where: { id: cur.id },
        data:  { adjusted: newAdjusted, status: newStatus },
      });
      adjustedPerAdvance.push({ id: cur.id, delta: take, newAdjusted, newStatus });
      remaining -= take;
      advanceAdjusted += take;
    }

    const inv = await tx.invoice.create({
      data: {
        orgId:         ctx.orgId,
        branchId:      order.branchId,
        number,
        type,
        clientId:      order.clientId,
        orderId:       order.id,
        date:          invoiceDate,
        dueDate:       computedDue,
        placeOfSupply: client.stateCode,
        taxableAmount: order.taxableAmount,
        cgst:          order.cgst,
        sgst:          order.sgst,
        igst:          order.igst,
        roundOff,
        total:         order.total,
        advanceAdjusted,
        // If the advance covers the whole invoice, mark it PAID
        // straight away; otherwise ISSUED (payment still owed).
        status:        advanceAdjusted >= order.total ? "PAID" : "ISSUED",
        // IRN: gated on org GSTIN + B2B threshold. For now everything
        // starts NOT_REQUIRED. Session 8 backend wires the real GSP call.
        irnStatus:     "NOT_REQUIRED",
        createdById:   ctx.userId,
      },
      select: { id: true, number: true },
    });

    // Audit each drained advance (one row per touched Advance) so
    // the trail is per-source, not per-invoice.
    for (const adj of adjustedPerAdvance) {
      await tx.auditLog.create({
        data: {
          orgId: ctx.orgId, actorId: ctx.userId,
          entityType: "Advance", entityId: adj.id,
          action: "ADJUST_TO_INVOICE",
          after: {
            invoiceId:   inv.id,
            invoiceNo:   inv.number,
            delta:       adj.delta.toString(),
            newAdjusted: adj.newAdjusted.toString(),
            newStatus:   adj.newStatus,
          },
        },
      });
    }
    await tx.invoiceLine.createMany({
      data: order.lines.map((l, i) => ({
        invoiceId:   inv.id,
        lineNo:      l.lineNo,
        productId:   l.productId,
        description: l.description,
        quantity:    l.orderedQty,
        rate:        l.rate,
        discountPct: new Prisma.Decimal(0),
        taxable:     perLineTaxable[i]!,
        gstRate:     l.gstRate,
        cgst:        perLineCgst[i]!,
        sgst:        perLineSgst[i]!,
        igst:        perLineIgst[i]!,
        amount:      l.amount,
      })),
    });
    return inv;
  });

  safeRevalidate("/invoicing");
  safeRevalidate(`/orders/${order.id}`);
  safeRevalidate("/accounts");

  // §14 Phase 8 — fire-and-forget WhatsApp notification. Best-
  // effort; a WhatsApp failure here must never rollback the invoice
  // write, so it's outside the tx and its throw is swallowed. The
  // idempotencyKey means a re-send (e.g. cache retry) doesn't cost
  // another 12 paise per Meta message.
  try {
    const { sendWhatsAppMessage } = await import("@/modules/whatsapp/actions");
    await sendWhatsAppMessage({
      templateName:   "invoice_issued",
      language:       "en",
      toMobile:       client.primaryMobile,
      params:         { "1": created.number },
      idempotencyKey: `invoice:${created.id}:issued`,
      entityType:     "INVOICE",
      entityId:       created.id,
    });
  } catch { /* ignore — WhatsApp is best-effort */ }

  return { ok: true, data: created };
}

export async function cancelInvoice(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.cancel");

  const parsed = cancelInvoiceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const { id, reason } = parsed.data;

  const db = scoped(ctx);
  const inv = await db.invoice.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, createdAt: true, number: true },
  });
  if (inv.status === "CANCELLED") {
    return { ok: false, error: "Invoice is already cancelled." };
  }
  if (inv.status === "PAID" || inv.status === "PARTIALLY_PAID") {
    return { ok: false, error: "Payments have been received. Reverse the receipts before cancelling." };
  }

  const ageHours = (Date.now() - inv.createdAt.getTime()) / 3_600_000;
  if (ageHours > CANCEL_WINDOW_HOURS) {
    return {
      ok: false,
      error: `Cancellation window closed (${CANCEL_WINDOW_HOURS}h). Issue a credit note against ${inv.number} instead.`,
    };
  }

  await db.invoice.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason,
    },
  });

  safeRevalidate("/invoicing");
  safeRevalidate(`/invoicing/${id}`);
  return { ok: true, data: { id } };
}

// ── helpers ──────────────────────────────────────────────────────

function zodError<T = unknown>(err: z.ZodError): ActionResult<T> {
  const fieldErrors: Record<string, string> = {};
  for (const iss of err.issues) {
    const p = iss.path
      .filter((seg): seg is string | number => typeof seg === "string" || typeof seg === "number")
      .join(".");
    if (!fieldErrors[p]) fieldErrors[p] = iss.message;
  }
  return { ok: false, error: "Validation failed", fieldErrors };
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}
