"use server";

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { allocateNumber, yymmFromDate } from "@/kernel/numbering/series";
import { devContext } from "@/lib/dev-context";
import { createInvoiceSchema } from "./schema";
import { zodError } from "./actions-part2-util";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "invoice.create");

  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const db = scoped(ctx);

  // Validate order exists and is not cancelled
  const order = await db.order.findUnique({
    where: { id: d.orderId },
    select: { id: true, projectId: true, clientId: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (order.status === "CANCELLED") return { ok: false, error: "Cannot invoice a cancelled order." };

  // Fetch branch for invoice prefix
  const branch = await db.branch.findUnique({
    where: { id: d.branchId },
    select: { invoicePrefix: true },
  });
  if (!branch) return { ok: false, error: "Branch not found." };

  // Compute totals from provided lines
  const lines = d.lines.map((l) => ({
    ...l,
    taxableBig: BigInt(l.taxable),
    cgstBig:    BigInt(l.cgst),
    sgstBig:    BigInt(l.sgst),
    igstBig:    BigInt(l.igst),
    amountBig:  BigInt(l.amount),
  }));

  const taxableAmount = lines.reduce((s, l) => s + l.taxableBig, 0n);
  const cgstTotal     = lines.reduce((s, l) => s + l.cgstBig, 0n);
  const sgstTotal     = lines.reduce((s, l) => s + l.sgstBig, 0n);
  const igstTotal     = lines.reduce((s, l) => s + l.igstBig, 0n);
  const lineTotal     = lines.reduce((s, l) => s + l.amountBig, 0n);
  const computedTotal = taxableAmount + cgstTotal + sgstTotal + igstTotal;
  const roundOff      = lineTotal - computedTotal;
  const total         = lineTotal;

  const invoiceDate = new Date(d.date);
  const yymm        = yymmFromDate(invoiceDate);

  let created: { id: string; number: string };
  try {
    created = await withTransaction(async (tx: TxClient) => {
      // ── Advance consumption inside the transaction with row locking.
      // SELECT FOR UPDATE serialises concurrent invoice creations on the same
      // project: a second transaction blocks at this statement until the first
      // commits, so it sees the already-updated `adjusted` values and cannot
      // double-consume the same advance balance.
      let advanceAdjusted = 0n;
      if (order.projectId) {
        type AdvRow = { id: string; amount: bigint; adjusted: bigint };
        const lockedAdvs = await tx.$queryRaw<AdvRow[]>`
          SELECT id, amount, adjusted FROM "Advance"
          WHERE "projectId" = ${order.projectId}
            AND "organizationId" = ${ctx.orgId}
          ORDER BY "receivedAt" ASC
          FOR UPDATE
        `;

        let remaining = total;
        const updates: Array<{ id: string; newAdjusted: bigint }> = [];
        for (const adv of lockedAdvs) {
          if (remaining <= 0n) break;
          const amt   = BigInt(adv.amount);
          const adj   = BigInt(adv.adjusted);
          const avail = amt - adj;
          if (avail <= 0n) continue;
          const apply = avail < remaining ? avail : remaining;
          advanceAdjusted += apply;
          remaining       -= apply;
          updates.push({ id: adv.id, newAdjusted: adj + apply });
        }
        for (const u of updates) {
          await tx.advance.update({
            where: { id: u.id },
            data:  { adjusted: u.newAdjusted },
          });
        }
      }

      // Status: PAID if fully covered by advances, else ISSUED
      const outstanding0  = total - advanceAdjusted;
      const initialStatus = outstanding0 <= 0n ? "PAID" : "ISSUED";

      // Allocate invoice number gap-free inside the same transaction.
      // Credit notes get their own "CN" series so a glance at the number
      // distinguishes them from tax invoices — matters for GSTR-1 audit.
      const number = await allocateNumber(tx, {
        orgId:  ctx.orgId,
        series: d.type === "CREDIT_NOTE" ? "CN" : "INV",
        yymm,
        prefix: branch.invoicePrefix,
      });

      const inv = await tx.invoice.create({
        data: {
          organizationId:    ctx.orgId,
          branchId:          d.branchId,
          number,
          type:              d.type,
          clientId:          order.clientId,
          orderId:           d.orderId,
          projectId:         order.projectId,
          date:              invoiceDate,
          dueDate:           new Date(d.dueDate),
          placeOfSupplyCode: d.placeOfSupplyCode,
          taxableAmount,
          cgst:              cgstTotal,
          sgst:              sgstTotal,
          igst:              igstTotal,
          roundOff,
          total,
          advanceAdjusted,
          status:            initialStatus,
          irnStatus:         "NOT_REQUIRED",
          ...(d.creditNoteReason  != null && { creditNoteReason:  d.creditNoteReason  }),
          ...(d.originalInvoiceId != null && { originalInvoiceId: d.originalInvoiceId }),
        },
        select: { id: true, number: true },
      });

      await tx.invoiceLine.createMany({
        data: d.lines.map((l, i) => ({
          organizationId: ctx.orgId,
          invoiceId:      inv.id,
          lineNo:         i + 1,
          orderLineId:    l.orderLineId ?? null,
          description:    l.description,
          hsn:            l.hsn,
          quantity:       new Decimal(l.quantity),
          unit:           l.unit,
          rate:           BigInt(l.rate),
          taxable:        BigInt(l.taxable),
          gstRate:        new Decimal(l.gstRate),
          cgst:           BigInt(l.cgst),
          sgst:           BigInt(l.sgst),
          igst:           BigInt(l.igst),
          amount:         BigInt(l.amount),
        })),
      });

      return inv;
    }, { orgId: ctx.orgId });
  } catch (err) {
    // DB partial unique index fires when a concurrent creation slips past the
    // pre-check in createInvoiceFromOrder. Check the constraint name so we
    // don't swallow an unrelated P2002 (e.g. a number-sequence collision).
    const code   = (err as { code?: string }).code;
    const meta   = (err as { meta?: { target?: unknown } }).meta;
    const target = Array.isArray(meta?.target)
      ? (meta.target as string[]).join(",")
      : String(meta?.target ?? "");
    if (code === "P2002" && target.includes("invoice_order_active_unique")) {
      return { ok: false, error: "An active invoice already exists for this order." };
    }
    throw err;
  }

  revalidatePath("/invoicing");
  if (order.projectId) revalidatePath(`/projects/${order.projectId}`);
  return { ok: true, data: created };
}
