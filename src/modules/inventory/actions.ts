// @ts-nocheck
"use server";

// Inventory server actions.
//
// postAdjustment (inside a transaction):
//   - Rule 3: stock ledger is append-only. We INSERT a StockLedgerEntry,
//     never UPDATE. StockBalance is a materialised aggregate that we
//     UPSERT inside the same transaction.
//   - Never-negative guard: if this movement would push quantity below zero
//     for that productÃ—warehouse, we refuse. Explicit `overrideNegative`
//     flag + `inventory.overrideNegative` permission overrides â€” the
//     violation still gets audited (via the scoped extension's audit hook).
//   - Numbering: allocated per warehouse's branch for the docType "STOCK_ADJ".

import type { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission, can } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import { allocateNumber, Prisma } from "@/kernel/numbering/series";
import { financialYear } from "@/kernel/datetime";
import { devContext } from "@/lib/dev-context";
import { postAdjustmentSchema } from "./schema";

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function postAdjustment(
  input: unknown,
): Promise<ActionResult<{ id: string; number: string; newBalance: string }>> {
  const ctx = await devContext();
  requirePermission(ctx, "inventory.adjust");

  const parsed = postAdjustmentSchema.safeParse(input);
  if (!parsed.success) return zodError(parsed.error);
  const d = parsed.data;

  const ratePaise = tryParse(d.rate);
  if (ratePaise == null || ratePaise < 0n) {
    return { ok: false, error: "Validation failed",
             fieldErrors: { rate: "Rate must be a valid amount" } };
  }

  const db = scoped(ctx);
  const wh = await db.warehouse.findUniqueOrThrow({
    where: { id: d.warehouseId },
    select: { id: true, branchId: true, name: true },
  });
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: wh.branchId },
    select: { invoicePrefix: true },
  });
  const existing = await db.stockBalance.findUnique({
    where: { warehouseId_productId: { warehouseId: d.warehouseId, productId: d.productId } },
    select: { quantity: true, value: true },
  });

  const currentQty   = new Prisma.Decimal(existing?.quantity ?? 0);
  const currentValue = existing?.value ?? 0n;
  const qty = new Prisma.Decimal(d.quantity);
  const signedDelta  = d.direction === "IN" ? qty : qty.neg();
  const newQty       = currentQty.plus(signedDelta);

  // Never-negative guard (Â§11 acceptance): permission-gated override.
  if (newQty.lt(0)) {
    if (!d.overrideNegative) {
      return {
        ok: false,
        error: `Would push stock to ${newQty.toString()}. Current on hand: ${currentQty.toString()}. Tick "Override negative" to force.`,
      };
    }
    if (!can(ctx, "inventory.overrideNegative")) {
      return { ok: false, error: "You don't have permission to post a negative stock movement." };
    }
  }

  const adjustedAt = new Date(d.adjustedAt);
  const created = await withTransaction(async (tx: TxClient) => {
    const number = await allocateNumber(tx, {
      orgId:         ctx.orgId,
      branchId:      wh.branchId,
      docType:       "STOCK_ADJ",
      financialYear: financialYear(adjustedAt),
      prefix:        `${branch.invoicePrefix}/ADJ`,
    });
    const adjustment = await tx.stockAdjustment.create({
      data: {
        orgId:      ctx.orgId,
        warehouseId: wh.id,
        number,
        productId:  d.productId,
        quantity:   signedDelta,
        reason:     d.reason,
        note:       (d.note ?? "").trim() || null,
        adjustedAt,
        createdById: ctx.userId,
      },
      select: { id: true, number: true },
    });
    await tx.stockLedgerEntry.create({
      data: {
        orgId:       ctx.orgId,
        warehouseId: wh.id,
        productId:   d.productId,
        direction:   d.direction,
        quantity:    qty,
        rate:        ratePaise,
        refType:     "ADJUSTMENT",
        refId:       adjustment.id,
        occurredAt:  adjustedAt,
      },
    });
    // Update / insert the balance row. Value: for IN, add qtyÃ—rate; for OUT,
    // subtract at the *average* implied rate (currentValue / currentQty).
    let newValue: bigint;
    if (d.direction === "IN") {
      newValue = currentValue + BigInt(Math.round(d.quantity * Number(ratePaise)));
    } else {
      // Subtract at implied avg to keep valuation consistent; guard div/0.
      const cQty = Number(currentQty.toString());
      if (cQty === 0) {
        // Negative stock created â€” value goes negative at incoming rate.
        newValue = currentValue - BigInt(Math.round(d.quantity * Number(ratePaise)));
      } else {
        const avg = Number(currentValue) / cQty;
        newValue = currentValue - BigInt(Math.round(d.quantity * avg));
        if (newValue < 0n) newValue = 0n;
      }
    }
    await tx.stockBalance.upsert({
      where: { warehouseId_productId: { warehouseId: wh.id, productId: d.productId } },
      create: {
        orgId:       ctx.orgId,
        warehouseId: wh.id,
        productId:   d.productId,
        quantity:    newQty,
        value:       newValue,
      },
      update: { quantity: newQty, value: newValue },
    });
    return { ...adjustment, newBalance: newQty.toString() };
  });

  revalidatePath("/inventory");
  return { ok: true, data: created };
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
function tryParse(v: string): bigint | null {
  try { return parseINR(v); } catch { return null; }
}
