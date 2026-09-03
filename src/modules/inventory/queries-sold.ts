// Read models for the "Sold out" tab: what can be sold, and what was.
//
// Kept out of ./queries.ts, which is already the whole stock list, KPI
// and family-filter surface.

import { Decimal } from "@prisma/client/runtime/library";
import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import { computeReservations } from "@/modules/stock/reservations";

/** One choosable item in the sell form's picker. */
export interface SellableItem {
  colourwayId: string;
  code:        string;
  label:       string;        // "Marbella Weave — Oyster"
  brandName:   string;
  sellUnit:    string;
  /** on-hand − reserved, as a decimal string. Never below zero. */
  available:   string;
  /** Physical on-hand across every lot, for the "x committed" hint. */
  onHand:      string;
  /** Dye lots this SKU actually has stock on. Empty when it isn't lot-tracked. */
  dyeLots:     string[];
  /** Most recent selling price seen (RETAIL/MRP), as paise string. "0" when unpriced. */
  ratePaise:   string;
}

/** One row in the "recently sold" list. */
export interface SoldOutRow {
  id:         string;
  occurredAt: Date;
  label:      string;
  code:       string;
  dyeLot:     string | null;
  quantity:   string;
  sellUnit:   string;
  /** Sale price per unit in paise. 0 when none was entered. */
  ratePaise:  bigint;
  /** quantity × rate, in paise. */
  totalPaise: bigint;
  /** Buyer and/or note, as recorded on the move. */
  soldTo:     string | null;
}

const PICKER_LIMIT = 300;

/**
 * Every SKU with stock on hand, with its live availability.
 *
 * Deliberately not paged. The picker is a search-as-you-type list the
 * operator scans, and a second page they cannot see is worse than a cap
 * they can be told about — 300 covers the studio's catalogue with room
 * to spare, and StockItemPicker prints a line under the results when the
 * list comes back full, so a studio that outgrows it finds out rather
 * than quietly failing to find an item.
 */
export async function listSellableStock(ctx: RequestContext): Promise<SellableItem[]> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);

  const items = await db.colourway.findMany({
    where:   { isActive: true, stock: { some: {} } },
    take:    PICKER_LIMIT,
    orderBy: [{ design: { name: "asc" } }, { colourName: "asc" }],
    select: {
      id: true, code: true, colourName: true, sellUnit: true,
      design: {
        select: {
          name: true,
          collection: { select: { brand: { select: { name: true } } } },
        },
      },
      stock:  { select: { quantity: true, dyeLot: true } },
      prices: {
        where: {
          tier: { in: ["RETAIL", "MRP"] },
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take:    1,
        select:  { amount: true },
      },
    },
  });

  const reservations = await computeReservations(ctx, items.map((i) => i.id));

  return items
    .map((i) => {
      const onHand = i.stock.reduce(
        (sum, b) => sum.plus(new Decimal(b.quantity)),
        new Decimal(0),
      );
      const reserved  = reservations.get(i.id)?.total ?? 0;
      const available = Decimal.max(onHand.minus(new Decimal(reserved)), new Decimal(0));
      return {
        colourwayId: i.id,
        code:        i.code,
        label:       `${i.design.name} — ${i.colourName}`,
        brandName:   i.design.collection.brand.name,
        sellUnit:    i.sellUnit,
        available:   available.toString(),
        onHand:      onHand.toString(),
        dyeLots: [...new Set(
          i.stock
            .filter((b) => b.dyeLot != null && new Decimal(b.quantity).gt(0))
            .map((b) => b.dyeLot as string),
        )].sort(),
        ratePaise:   (i.prices[0]?.amount ?? 0n).toString(),
      };
    })
    // An item with nothing left to sell is noise in a picker whose whole
    // job is choosing what to sell.
    .filter((i) => new Decimal(i.available).gt(0));
}

/** Recent counter sales, newest first. */
export async function listSoldOut(
  ctx:   RequestContext,
  limit = 50,
): Promise<SoldOutRow[]> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);

  const moves = await db.stockMove.findMany({
    where:   { type: "SOLD_OUT" },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take:    Math.min(limit, 200),
    select: {
      id: true, colourwayId: true, dyeLot: true, quantity: true,
      rate: true, refId: true, occurredAt: true,
    },
  });
  if (moves.length === 0) return [];

  // StockMove has no Prisma relation to Colourway — resolve names in one
  // batched read, the same way the GST summary resolves client names.
  const colourways = await db.colourway.findMany({
    where:  { id: { in: [...new Set(moves.map((m) => m.colourwayId))] } },
    select: {
      id: true, code: true, colourName: true, sellUnit: true,
      design: { select: { name: true } },
    },
  });
  const byId = new Map(colourways.map((c) => [c.id, c]));

  return moves.map((m) => {
    const c   = byId.get(m.colourwayId);
    const qty = new Decimal(m.quantity);
    return {
      id:         m.id,
      occurredAt: m.occurredAt,
      label:      c ? `${c.design.name} — ${c.colourName}` : "Unknown item",
      code:       c?.code ?? "—",
      dyeLot:     m.dyeLot,
      quantity:   qty.toString(),
      sellUnit:   c?.sellUnit ?? "",
      ratePaise:  m.rate,
      // Money stays BigInt paise end to end (CLAUDE.md #8). Quantity can
      // carry three decimals, so multiply in thousandths and divide back
      // down rather than going through a float.
      totalPaise: (m.rate * BigInt(qty.times(1000).toFixed(0))) / 1000n,
      soldTo:     m.refId === "counter-sale" ? null : m.refId,
    };
  });
}

/** Headline figures above the sold list, for the period shown. */
export interface SoldOutTotals {
  saleCount:   number;
  unitsSold:   string;
  valuePaise:  bigint;
}

export function summariseSoldOut(rows: SoldOutRow[]): SoldOutTotals {
  return {
    saleCount:  rows.length,
    unitsSold:  rows
      .reduce((sum, r) => sum.plus(new Decimal(r.quantity)), new Decimal(0))
      .toString(),
    valuePaise: rows.reduce((sum, r) => sum + r.totalPaise, 0n),
  };
}
