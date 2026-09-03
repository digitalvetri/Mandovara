"use server";

// Record a counter sale — the "Sold out" tab under Stock.
//
// Owner instruction, 2026-09-04: "select the item from the stock, say
// how many pieces were sold, and that should be reduced from the stock
// list." Until now the only outward path from /inventory was
// adjustStock, whose reasons are STOCK_TAKE, DAMAGE, THEFT, EXPIRY and
// OTHER — so every sale was being filed as a correction or as loss, and
// "what did we sell" could not be answered from the ledger at all.
//
// Shaped deliberately like adjustStock, because it is the same physical
// event with a different meaning: one StockMove row, one StockBalance
// upsert, then a reorder check, all inside one transaction, with the
// domain event published only after it commits.
//
// Two things it does that adjustStock does not:
//   · refuses to sell more than is AVAILABLE (on-hand minus what live
//     quotes and orders have already committed), rather than only
//     refusing to go below zero. Selling stock off the shelf that a
//     confirmed order is waiting on is the expensive mistake here, and
//     the lot dropdown must not be a way around it — see the gate.
//   · records the sale price, so the move carries what the stock left
//     for and not just what it cost.

import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";
import { withTransaction, type TxClient } from "@/kernel/db/transaction";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import { parseINR } from "@/kernel/money/format";
import {
  checkReorderCrossing, emitBelowReorderIfCrossed,
} from "@/kernel/inventory/reorder";
import { computeReservations } from "@/modules/stock/reservations";
import { devContext } from "@/lib/dev-context";
import { saleCeiling } from "./sold-availability";
import { recordStockSaleSchema } from "./schema-sold";
import type { ActionResult } from "./actions";

export async function recordStockSale(
  input: unknown,
): Promise<ActionResult<{ id: string; newOnHand: string }>> {
  const ctx = await devContext();
  // No new permission key. Taking stock off the shelf is inventory.adjust
  // whichever door it leaves by, and inventing "inventory.sell" would
  // mean every existing Store role silently loses the ability to do it.
  requirePermission(ctx, "inventory.adjust");

  const parsed = recordStockSaleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const db = scoped(ctx);
  const cw = await db.colourway.findUnique({
    where:  { id: d.colourwayId },
    select: {
      id: true, code: true, colourName: true, sellUnit: true, isActive: true,
      design: { select: { name: true } },
    },
  });
  if (!cw) return { ok: false, error: "Item not found" };
  if (!cw.isActive) return { ok: false, error: "That item is no longer active" };

  const dyeLot = d.dyeLot?.trim() || null;

  // Rate is money — parseINR gives BigInt paise. A bad string is a field
  // error, not a silent zero.
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

  // ── The availability gate ───────────────────────────────────────────
  // The rule itself is a pure function in ./sold-availability.ts, where
  // it is unit-tested. All this does is feed it and phrase the refusal.
  const balances = await db.stockBalance.findMany({
    where:  { colourwayId: cw.id },
    select: { quantity: true, dyeLot: true },
  });
  const reserved = (await computeReservations(ctx, [cw.id])).get(cw.id)?.total ?? 0;
  const ceiling  = saleCeiling(balances, dyeLot, reserved);

  const qty = new Decimal(d.quantity);
  if (qty.gt(ceiling.available)) {
    const unit = cw.sellUnit.toLowerCase();
    // Say which ceiling was hit — "only 3m on that lot" and "12m is
    // spoken for" call for different actions at the counter.
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: {
        quantity: ceiling.blockedByCommitment
          ? `Only ${ceiling.available} ${unit} available — ${ceiling.totalOnHand} in stock, ${reserved} already committed to live quotes and orders.`
          : `Only ${ceiling.available} ${unit} in stock${dyeLot ? ` on lot ${dyeLot}` : ""}.`,
      },
    };
  }

  const soldOn = new Date(d.soldOn);
  const negativeDelta = qty.negated();

  const applied = await withTransaction(async (tx: TxClient) => {
    // Compound unique key needs a non-null dyeLot at the TS layer even
    // though Postgres accepts NULL — findFirst, same as adjustStock.
    const existing = await tx.stockBalance.findFirst({
      where:  { colourwayId: cw.id, dyeLot },
      select: { id: true, quantity: true, value: true },
    });
    if (!existing) {
      throw new Error("NO_BALANCE_ROW");
    }

    const curQty = new Decimal(existing.quantity);
    const nextQty = curQty.minus(qty);

    // Value comes off at the implied average cost, NOT at the sale
    // price: StockBalance.value is what the stock cost us, and crediting
    // it with revenue would inflate the closing stock figure that lands
    // on the balance sheet. Margin belongs in the invoice, not here.
    const curVal = existing.value;
    let nextVal: bigint;
    const cQ = Number(curQty);
    if (cQ === 0) {
      nextVal = curVal;
    } else {
      const avgPaise = Number(curVal) / cQ;
      nextVal = curVal - BigInt(Math.round(Number(qty) * avgPaise));
      if (nextVal < 0n) nextVal = 0n;
    }

    const move = await tx.stockMove.create({
      data: {
        organizationId: ctx.orgId,
        colourwayId:    cw.id,
        dyeLot,
        type:           "SOLD_OUT",
        quantity:       qty,
        rate:           ratePaise,
        refType:        "SALE",
        // StockMove has no buyer or note column and this is not the place
        // to add one — the ledger's job is quantities. The buyer, when
        // there is one, rides in refId so the row can still be traced
        // back to a person at the counter.
        refId:          buildRef(d.soldTo, d.note),
        occurredAt:     soldOn,
        createdById:    ctx.userId,
      },
      select: { id: true },
    });

    await tx.stockBalance.update({
      where: { id: existing.id },
      data:  { quantity: nextQty, value: nextVal },
    });

    // Signed delta — negative, because stock went out.
    const crossing = await checkReorderCrossing(tx, cw.id, negativeDelta);
    return { moveId: move.id, crossing };
  }, { orgId: ctx.orgId }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "NO_BALANCE_ROW") return null;
    throw e;
  });

  if (applied == null) {
    return {
      ok: false,
      error: dyeLot
        ? `Nothing on lot ${dyeLot} to sell.`
        : "That item has no stock recorded yet.",
    };
  }
  const { moveId, crossing } = applied;

  // After commit — the bus handlers create low-stock notifications.
  await emitBelowReorderIfCrossed({
    orgId:       ctx.orgId,
    actorId:     ctx.userId,
    colourwayId: cw.id,
    crossing,
  });

  revalidatePath("/inventory");
  revalidatePath("/inventory/sold");
  return { ok: true, data: { id: moveId, newOnHand: crossing.currentQty } };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** "Walk-in · Mrs Iyer — 2 cushion covers", trimmed to the column. */
function buildRef(soldTo?: string, note?: string): string {
  const parts = [soldTo?.trim(), note?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ").slice(0, 300) : "counter-sale";
}

function fieldErrorsOf(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const iss of issues) {
    const p = iss.path
      .filter((s): s is string | number => typeof s === "string" || typeof s === "number")
      .join(".");
    if (!out[p]) out[p] = iss.message;
  }
  return out;
}
