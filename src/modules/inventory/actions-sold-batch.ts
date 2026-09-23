"use server";

// Record a counter sale of SEVERAL items to one buyer — the "Record a
// sale" form under Stock → Sold out.
//
// Owner instruction, 2026-09-23: "a single client can purchase too many
// items, so I need to select more items from the item list — I need to
// enter the client name one time and then mark the details of each
// product."
//
// No sale-header table (CLAUDE.md #14). A sale is still exactly what it
// was: SOLD_OUT rows in the StockMove ledger. A five-item basket writes
// five of them carrying the same buyer, note and date, so Sold out's
// list, its totals and the edit pencil all keep working with no change
// to any of them.
//
// Everything single-item recordStockSale did, this does per line —
// availability gate, average-cost write-down, reorder check — with three
// differences that only exist because a basket can name the same SKU
// twice:
//
//   · the availability gate runs across the WHOLE basket (checkBasket),
//     so two lines of the same SKU cannot each pass on their own and
//     oversell between them;
//   · the reorder check runs ONCE per colourway on the summed delta,
//     because checkReorderCrossing reads the post-write balance and
//     subtracts the delta to reconstruct the "before" — calling it per
//     line for a repeated SKU would reconstruct the wrong one;
//   · every refusal names its line (`lines.2.quantity`), because "that
//     item has no stock recorded yet" is useless against a basket of
//     five.
//
// The whole basket is one transaction: a half-recorded sale is worse
// than a refused one, since the operator cannot see which half landed.

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
import { checkBasket, type BasketLine, type LotBalance } from "./sold-availability";
import { fieldErrorsOf, recordStockSaleBatchSchema } from "./schema-sold";
import type { ActionResult } from "./actions";

/** A line failed inside the transaction — carries which one. */
class LineError extends Error {
  constructor(readonly lineIndex: number, readonly detail: string) {
    super("LINE_ERROR");
  }
}

export async function recordStockSaleBatch(
  input: unknown,
): Promise<ActionResult<{ ids: string[]; lineCount: number; newOnHand: Record<string, string> }>> {
  const ctx = await devContext();
  // Same key as the single-item path — taking stock off the shelf is
  // inventory.adjust whichever door it leaves by.
  requirePermission(ctx, "inventory.adjust");

  const parsed = recordStockSaleBatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
      fieldErrors: fieldErrorsOf(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const db  = scoped(ctx);
  const ids = [...new Set(d.lines.map((l) => l.colourwayId))];

  const colourways = await db.colourway.findMany({
    where:  { id: { in: ids } },
    select: { id: true, code: true, colourName: true, sellUnit: true, isActive: true },
  });
  const byId = new Map(colourways.map((c) => [c.id, c]));

  // ── Per-line shape checks ───────────────────────────────────────────
  // Done before anything is written, and all reported against their own
  // line so the operator fixes the right row.
  const lines: (BasketLine & { ratePaise: bigint; sellUnit: string })[] = [];
  for (const [i, l] of d.lines.entries()) {
    const cw = byId.get(l.colourwayId);
    if (!cw) {
      return { ok: false, error: "Validation failed", fieldErrors: { [`lines.${i}.quantity`]: "Item not found" } };
    }
    if (!cw.isActive) {
      return { ok: false, error: "Validation failed", fieldErrors: { [`lines.${i}.quantity`]: "That item is no longer active" } };
    }

    let ratePaise = 0n;
    if (l.rate && l.rate.trim()) {
      try {
        ratePaise = parseINR(l.rate);
      } catch {
        return { ok: false, error: "Validation failed", fieldErrors: { [`lines.${i}.rate`]: "Could not read that amount" } };
      }
      // parseINR honours "(500)" and "-500" as negative — an accounting
      // convention that has no meaning on a sale price, and would put a
      // negative rate in the ledger and a negative sale value in the
      // totals. A refund is a corrected or removed sale, not a sale at
      // minus five hundred.
      if (ratePaise < 0n) {
        return { ok: false, error: "Validation failed", fieldErrors: { [`lines.${i}.rate`]: "A sale price cannot be negative" } };
      }
    }

    lines.push({
      colourwayId: l.colourwayId,
      dyeLot:      l.dyeLot?.trim() || null,
      quantity:    l.quantity,
      ratePaise,
      sellUnit:    cw.sellUnit,
    });
  }

  // ── The availability gate, across the whole basket ──────────────────
  // The rule is the pure, unit-tested checkBasket; all this does is feed
  // it and phrase the refusal.
  const allBalances = await db.stockBalance.findMany({
    where:  { colourwayId: { in: ids } },
    select: { colourwayId: true, quantity: true, dyeLot: true },
  });
  const balances = new Map<string, LotBalance[]>(ids.map((id) => [id, []]));
  for (const b of allBalances) {
    balances.get(b.colourwayId)?.push({ dyeLot: b.dyeLot, quantity: b.quantity });
  }

  const reservations = await computeReservations(ctx, ids);
  const reserved = new Map(ids.map((id) => [id, reservations.get(id)?.total ?? 0]));

  const breach = checkBasket(lines, balances, reserved);
  if (breach) {
    const line = lines[breach.lineIndex];
    const unit = (line?.sellUnit ?? "").toLowerCase();
    const commitment = reserved.get(breach.colourwayId) ?? 0;
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: {
        [`lines.${breach.lineIndex}.quantity`]: breach.blockedByCommitment
          ? `Only ${breach.available} ${unit} available — ${breach.totalOnHand} in stock, ${commitment} already committed to live quotes and orders.`
          : `Only ${breach.available} ${unit} left to sell${breach.dyeLot ? ` on lot ${breach.dyeLot}` : ""}${
              countsOf(lines, breach.colourwayId) > 1 ? ", counting the other lines on this sale" : ""
            }.`,
      },
    };
  }

  const soldOn = new Date(d.soldOn);
  const ref    = buildRef(d.soldTo, d.note);

  // ── The write ───────────────────────────────────────────────────────
  const applied = await withTransaction(async (tx: TxClient) => {
    const moveIds: string[] = [];
    /** Summed signed delta per colourway — the reorder check wants one
     *  call per SKU, not one per line. */
    const deltaBySku = new Map<string, Decimal>();

    for (const [i, line] of lines.entries()) {
      const qty = new Decimal(line.quantity);

      // Reads inside a transaction see the writes above them, so a
      // second line on the same lot takes its cost off the already
      // reduced balance — which is what "sold twice off one shelf"
      // means.
      const existing = await tx.stockBalance.findFirst({
        where:  { colourwayId: line.colourwayId, dyeLot: line.dyeLot },
        select: { id: true, quantity: true, value: true },
      });
      if (!existing) {
        throw new LineError(i, line.dyeLot
          ? `Nothing on lot ${line.dyeLot} to sell.`
          : "That item has no stock recorded yet.");
      }

      const curQty  = new Decimal(existing.quantity);
      const nextQty = curQty.minus(qty);

      // Value comes off at the implied average COST, not at the sale
      // price — StockBalance.value is what the stock cost us, and
      // crediting revenue here would inflate closing stock. Identical to
      // the single-item path; margin belongs on the invoice.
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
          colourwayId:    line.colourwayId,
          dyeLot:         line.dyeLot,
          type:           "SOLD_OUT",
          quantity:       qty,
          rate:           line.ratePaise,
          refType:        "SALE",
          // Every line of one basket carries the same buyer/note string,
          // which is what makes them read back as one sale.
          refId:          ref,
          occurredAt:     soldOn,
          createdById:    ctx.userId,
        },
        select: { id: true },
      });
      moveIds.push(move.id);

      await tx.stockBalance.update({
        where: { id: existing.id },
        data:  { quantity: nextQty, value: nextVal },
      });

      deltaBySku.set(
        line.colourwayId,
        (deltaBySku.get(line.colourwayId) ?? new Decimal(0)).minus(qty),
      );
    }

    // After every balance write, so the sums are the post-sale state.
    const crossings: { colourwayId: string; crossing: ReorderCrossing }[] = [];
    for (const [colourwayId, delta] of deltaBySku) {
      crossings.push({ colourwayId, crossing: await checkReorderCrossing(tx, colourwayId, delta) });
    }
    return { moveIds, crossings };
  }, { orgId: ctx.orgId }).catch((e: unknown) => {
    if (e instanceof LineError) return e;
    throw e;
  });

  if (applied instanceof LineError) {
    return {
      ok: false,
      error: applied.detail,
      fieldErrors: { [`lines.${applied.lineIndex}.quantity`]: applied.detail },
    };
  }

  // After commit — the bus handlers create the low-stock notifications.
  for (const c of applied.crossings) {
    await emitBelowReorderIfCrossed({
      orgId:       ctx.orgId,
      actorId:     ctx.userId,
      colourwayId: c.colourwayId,
      crossing:    c.crossing,
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/inventory/sold");
  return {
    ok: true,
    data: {
      ids:       applied.moveIds,
      lineCount: applied.moveIds.length,
      // Post-sale on-hand per SKU, for callers that report it.
      newOnHand: Object.fromEntries(
        applied.crossings.map((c) => [c.colourwayId, c.crossing.currentQty]),
      ),
    },
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** How many lines of the basket name this SKU — decides whether the
 *  refusal mentions the other lines. */
function countsOf(lines: readonly BasketLine[], colourwayId: string): number {
  return lines.filter((l) => l.colourwayId === colourwayId).length;
}

/** "Mrs Iyer — 2 cushion covers", trimmed to the column. Same shape the
 *  single-item path wrote, so old and new rows read identically. */
function buildRef(soldTo?: string, note?: string): string {
  const parts = [soldTo?.trim(), note?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ").slice(0, 300) : "counter-sale";
}
