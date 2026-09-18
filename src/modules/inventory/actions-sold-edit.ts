"use server";

// Correct a counter sale already recorded — the pencil on a "Recent
// sales" row under Stock → Sold out. Kept beside actions-sold.ts rather
// than in it only to respect the file-length limit; the two share the
// same shape and the same rules.

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import {
  checkReorderCrossing, emitBelowReorderIfCrossed, type ReorderCrossing,
} from "@/kernel/inventory/reorder";
import { computeReservations } from "@/modules/stock/reservations";
import { devContext } from "@/lib/dev-context";
import { editSaleCeiling } from "./sold-availability";
import { fieldErrorsOf, updateStockSaleSchema } from "./schema-sold";
import type { ActionResult } from "./actions";

/**
 * Correct a counter sale already on the books — the pencil on a
 * "Recent sales" row. Owner instruction, 2026-09-18.
 *
 * Edits the SOLD_OUT move IN PLACE rather than appending a reversal: the
 * Sold out list and its totals read SOLD_OUT rows directly, and a
 * reverse-and-re-record pair would count the sale twice there.
 *
 * Quantity, price, date and buyer/note can change. The item and dye lot
 * cannot — that is a different movement, and is a new sale. When the
 * quantity changes, the balance moves by the difference only, cost comes
 * off (or goes back) at the implied average exactly as recordStockSale
 * does, and the reorder check runs on that difference.
 */
export async function updateStockSale(
  input: unknown,
): Promise<ActionResult<{ id: string; newOnHand: string | null }>> {
  const ctx = await devContext();
  // Same key as recording a sale — see recordStockSale.
  requirePermission(ctx, "inventory.adjust");

  const parsed = updateStockSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  const move = await db.stockMove.findFirst({
    where:  { id: d.id, type: "SOLD_OUT" },
    select: { id: true, colourwayId: true, dyeLot: true, quantity: true },
  });
  if (!move) return { ok: false, error: "That sale could not be found" };

  const cw = await db.colourway.findUnique({
    where:  { id: move.colourwayId },
    select: { id: true, sellUnit: true },
  });
  if (!cw) return { ok: false, error: "Item not found" };

  let ratePaise = 0n;
  if (d.rate && d.rate.trim()) {
    try {
      ratePaise = parseINR(d.rate);
    } catch {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { rate: "Could not read that amount" },
      };
    }
  }

  const oldQty = new Decimal(move.quantity);
  const newQty = new Decimal(d.quantity);

  // Only an increase can run into the ceiling. The stock this sale
  // already took is credited back first (editSaleCeiling), so a sale is
  // never refused for the quantity it already had.
  if (newQty.gt(oldQty)) {
    const balances = await db.stockBalance.findMany({
      where:  { colourwayId: cw.id },
      select: { quantity: true, dyeLot: true },
    });
    const reserved = (await computeReservations(ctx, [cw.id])).get(cw.id)?.total ?? 0;
    const ceiling  = editSaleCeiling(balances, move.dyeLot, reserved, oldQty);
    if (newQty.gt(ceiling.available)) {
      const unit = cw.sellUnit.toLowerCase();
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: {
          quantity: ceiling.blockedByCommitment
            ? `At most ${ceiling.available} ${unit} — the rest is committed to live quotes and orders.`
            : `At most ${ceiling.available} ${unit}${move.dyeLot ? ` on lot ${move.dyeLot}` : ""} — that is all there is.`,
        },
      };
    }
  }

  const soldTo = d.soldTo?.trim() ?? "";

  const applied = await withTransaction(async (tx: TxClient) => {
    // Re-read inside the transaction so two people correcting the same
    // sale cannot both apply their difference against a stale quantity.
    const current = await tx.stockMove.findFirst({
      where:  { id: move.id, organizationId: ctx.orgId, type: "SOLD_OUT" },
      select: { quantity: true },
    });
    if (!current) throw new Error("SALE_GONE");

    // Positive = more went out than first recorded.
    const extraSold = newQty.minus(new Decimal(current.quantity));
    let crossing: ReorderCrossing | null = null;

    if (!extraSold.isZero()) {
      const bal = await tx.stockBalance.findFirst({
        where:  { colourwayId: cw.id, dyeLot: move.dyeLot },
        select: { id: true, quantity: true, value: true },
      });
      if (!bal) throw new Error("NO_BALANCE_ROW");

      const curQty  = new Decimal(bal.quantity);
      const nextQty = curQty.minus(extraSold);
      if (nextQty.lt(0)) throw new Error("WOULD_GO_NEGATIVE");

      // Cost at the implied average, same as recordStockSale: out when
      // more was sold, back in when less was.
      let nextVal = bal.value;
      const cQ = Number(curQty);
      if (cQ !== 0) {
        const avgPaise = Number(bal.value) / cQ;
        nextVal = bal.value - BigInt(Math.round(Number(extraSold) * avgPaise));
        if (nextVal < 0n) nextVal = 0n;
      }

      await tx.stockBalance.update({
        where: { id: bal.id },
        data:  { quantity: nextQty, value: nextVal },
      });
      crossing = await checkReorderCrossing(tx, cw.id, extraSold.negated());
    }

    await tx.stockMove.update({
      where: { id: move.id },
      data: {
        quantity:   newQty,
        rate:       ratePaise,
        refId:      soldTo ? soldTo.slice(0, 300) : "counter-sale",
        occurredAt: new Date(d.soldOn),
      },
    });

    return crossing;
  }, { orgId: ctx.orgId }).catch((e: unknown) => {
    if (e instanceof Error && ["SALE_GONE", "NO_BALANCE_ROW", "WOULD_GO_NEGATIVE"].includes(e.message)) {
      return e.message;
    }
    throw e;
  });

  if (applied === "SALE_GONE") return { ok: false, error: "That sale could not be found" };
  if (applied === "NO_BALANCE_ROW") return { ok: false, error: "That item has no stock row to adjust." };
  if (applied === "WOULD_GO_NEGATIVE") {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: { quantity: "There is not enough stock left for that quantity." },
    };
  }

  if (typeof applied === "string") return { ok: false, error: "Could not update the sale" };
  if (applied) {
    await emitBelowReorderIfCrossed({
      orgId:       ctx.orgId,
      actorId:     ctx.userId,
      colourwayId: cw.id,
      crossing:    applied,
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/sold");
  return { ok: true, data: { id: move.id, newOnHand: applied?.currentQty ?? null } };
}
