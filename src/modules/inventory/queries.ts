// Inventory repository — one query per surface the redesigned /inventory
// page needs. Reads against the real schema (Colourway · StockBalance ·
// StockMove · Design · PurchaseOrder). Storekeeper role sees everything;
// permissions per Rule 8 gate against inventory.view.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

// ── Stock tab: one row per Colourway (SKU) ────────────────────────────
export interface StockItemRow {
  colourwayId:   string;
  code:          string;
  colourName:    string;
  hex:           string | null;
  imageKey:      string | null;
  designName:    string;
  brandName:     string;
  family:        string;
  sellUnit:      string;
  onHand:        string;          // Σ StockBalance.quantity (decimal string)
  reorderLevel:  string | null;   // Colourway.reorderLevel, decimal string
  lastCostPaise: bigint;          // most recent StockMove.rate for GRN, else 0
  gstRate:       string;          // Design.gstRate decimal string
  isLow:         boolean;         // onHand <= reorderLevel (when set)
  isOut:         boolean;         // onHand === 0
}

export interface InventoryKpis {
  itemCount:        number;   // active Colourway rows
  lowStockCount:    number;   // items with reorderLevel set AND onHand <= reorderLevel
  openPoCount:      number;   // PurchaseOrder status in DRAFT / SENT / PARTIAL
  stockValuePaise:  bigint;   // Σ StockBalance.value across all lots
}

export interface ListStockItemsResult {
  rows:      StockItemRow[];
  total:     number;
  page:      number;
  pageSize:  number;
  families:  string[];        // distinct families across active items — powers the pill filter
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE     = 200;

export async function getInventoryKpis(ctx: RequestContext): Promise<InventoryKpis> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);

  const [items, balances, openPos] = await Promise.all([
    db.colourway.findMany({
      where:  { isActive: true },
      select: { id: true, reorderLevel: true },
    }),
    db.stockBalance.findMany({
      select: { colourwayId: true, quantity: true, value: true },
    }),
    db.purchaseOrder.count({
      where: { status: { in: ["DRAFT", "SENT", "PARTIAL"] } },
    }),
  ]);

  // Aggregate on-hand per colourway across dye lots so low-stock is
  // computed on the total, not per lot.
  const onHandByCw = new Map<string, number>();
  let stockValue = 0n;
  for (const b of balances) {
    onHandByCw.set(b.colourwayId, (onHandByCw.get(b.colourwayId) ?? 0) + Number(b.quantity));
    stockValue += b.value;
  }

  let low = 0;
  for (const it of items) {
    if (it.reorderLevel == null) continue;
    const on = onHandByCw.get(it.id) ?? 0;
    if (on <= Number(it.reorderLevel)) low += 1;
  }

  return {
    itemCount:       items.length,
    lowStockCount:   low,
    openPoCount:     openPos,
    stockValuePaise: stockValue,
  };
}

export async function listStockItems(
  ctx: RequestContext,
  q: { search?: string; family?: string | "ALL"; page?: number; pageSize?: number; onlyLow?: boolean; hasLot?: boolean },
): Promise<ListStockItemsResult> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);

  const pageSize = Math.min(q.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page     = Math.max(1, q.page ?? 1);
  const skip     = (page - 1) * pageSize;

  const where: Record<string, unknown> = { isActive: true };
  if (q.family && q.family !== "ALL") {
    where["design"] = { family: q.family };
  }
  if (q.hasLot) {
    // Only colourways that have at least one StockBalance row with a dye lot recorded.
    where["stock"] = { some: { dyeLot: { not: null } } };
  }
  if (q.search && q.search.trim()) {
    const s = q.search.trim();
    where["OR"] = [
      { code:       { contains: s, mode: "insensitive" } },
      { colourName: { contains: s, mode: "insensitive" } },
      { design: { name: { contains: s, mode: "insensitive" } } },
      { design: { code: { contains: s, mode: "insensitive" } } },
    ];
  }

  const [items, total, allFamiliesRaw] = await Promise.all([
    db.colourway.findMany({
      where, skip, take: pageSize,
      orderBy: [{ design: { name: "asc" } }, { colourName: "asc" }],
      select: {
        id: true, code: true, colourName: true, hex: true, imageKey: true, sellUnit: true,
        reorderLevel: true,
        design: {
          select: {
            name: true, family: true, gstRate: true,
            collection: { select: { brand: { select: { name: true } } } },
          },
        },
      },
    }),
    db.colourway.count({ where }),
    db.design.findMany({
      where:    { isActive: true },
      select:   { family: true },
      distinct: ["family"],
    }),
  ]);

  const colourwayIds = items.map((i) => i.id);
  const [balances, lastCosts] = await Promise.all([
    colourwayIds.length === 0 ? [] :
      db.stockBalance.findMany({
        where:  { colourwayId: { in: colourwayIds } },
        select: { colourwayId: true, quantity: true },
      }),
    // Last GRN rate per colourway. Query one recent GRN_IN move per SKU
    // in a single roundtrip (worst-case ordered scan, but colourwayIds
    // is bounded by page size = 50 so it's cheap).
    colourwayIds.length === 0 ? [] :
      db.stockMove.findMany({
        where: { colourwayId: { in: colourwayIds }, type: "GRN_IN" },
        orderBy: { occurredAt: "desc" },
        select: { colourwayId: true, rate: true, occurredAt: true },
      }),
  ]);

  const onHandByCw = new Map<string, number>();
  for (const b of balances) {
    onHandByCw.set(b.colourwayId, (onHandByCw.get(b.colourwayId) ?? 0) + Number(b.quantity));
  }
  const lastCostByCw = new Map<string, bigint>();
  for (const m of lastCosts) {
    if (!lastCostByCw.has(m.colourwayId)) lastCostByCw.set(m.colourwayId, m.rate);
  }

  let rows: StockItemRow[] = items.map((c) => {
    const onHand = onHandByCw.get(c.id) ?? 0;
    const reorder = c.reorderLevel == null ? null : Number(c.reorderLevel);
    return {
      colourwayId:   c.id,
      code:          c.code,
      colourName:    c.colourName,
      hex:           c.hex,
      imageKey:      c.imageKey,
      designName:    c.design.name,
      brandName:     c.design.collection.brand.name,
      family:        c.design.family,
      sellUnit:      c.sellUnit,
      onHand:        String(onHand),
      reorderLevel:  reorder == null ? null : String(reorder),
      lastCostPaise: lastCostByCw.get(c.id) ?? 0n,
      gstRate:       c.design.gstRate.toString(),
      isLow:         reorder != null && onHand <= reorder,
      isOut:         onHand === 0,
    };
  });

  if (q.onlyLow) rows = rows.filter((r) => r.isLow);

  const families = Array.from(new Set(allFamiliesRaw.map((f) => f.family))).sort();

  return { rows, total: q.onlyLow ? rows.length : total, page, pageSize, families };
}
