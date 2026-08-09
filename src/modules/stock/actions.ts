"use server";

import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { revalidatePath } from "next/cache";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { requirePermission } from "@/kernel/rbac/guard";
import { devContext } from "@/lib/dev-context";
import { allocateStockBalance } from "@/kernel/stock/allocate";
import { MixedLotError, InsufficientStockError } from "./lib";

// ── Schema ────────────────────────────────────────────────────────────────────

const allocateStockSchema = z.object({
  orderLineId:      z.string().min(1),
  colourwayId:      z.string().min(1),
  dyeLot:           z.string().trim().nullable(),
  quantity:         z.number().positive(),
  rate:             z.bigint(),
  mixedLotOverride: z.boolean().optional(),
  overrideReason:   z.string().trim().min(1).optional(),
});

export type AllocateStockInput = z.infer<typeof allocateStockSchema>;

// ── Action result ─────────────────────────────────────────────────────────────

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  errorCode?: "MIXED_LOT" | "INSUFFICIENT" | "VALIDATION";
  fieldErrors?: Record<string, string>;
}

// ── allocateStock ─────────────────────────────────────────────────────────────

export async function allocateStock(input: unknown): Promise<ActionResult> {
  const ctx = await devContext();
  requirePermission(ctx, "stock.allocate");

  const parsed = allocateStockSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const iss of parsed.error.issues) {
      const p = iss.path.join(".");
      if (!fieldErrors[p]) fieldErrors[p] = iss.message;
    }
    return { ok: false, error: "Validation failed", errorCode: "VALIDATION", fieldErrors };
  }

  const d = parsed.data;

  if (d.mixedLotOverride && !d.overrideReason) {
    return {
      ok: false,
      error: "Override reason is required when bypassing the mixed-lot gate",
      errorCode: "VALIDATION",
      fieldErrors: { overrideReason: "Required when overriding mixed-lot block" },
    };
  }

  try {
    await withTransaction(async (tx: TxClient) => {
      await allocateStockBalance(tx, {
        organizationId:   ctx.orgId,
        orderLineId:      d.orderLineId,
        colourwayId:      d.colourwayId,
        dyeLot:           d.dyeLot,
        quantity:         new Decimal(d.quantity),
        rate:             d.rate,
        createdById:      ctx.userId,
        mixedLotOverride: d.mixedLotOverride,
        overrideReason:   d.overrideReason,
        overrideById:     d.mixedLotOverride ? ctx.userId : undefined,
      });
    });
  } catch (err) {
    if (err instanceof MixedLotError) {
      return { ok: false, error: err.message, errorCode: "MIXED_LOT" };
    }
    if (err instanceof InsufficientStockError) {
      return { ok: false, error: err.message, errorCode: "INSUFFICIENT" };
    }
    throw err;
  }

  revalidatePath("/purchase/allocation");
  revalidatePath("/stock");
  return { ok: true };
}
