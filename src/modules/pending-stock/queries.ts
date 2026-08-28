// The verification queue — read side.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface PendingRow {
  id:            string;
  catalogueName: string | null;
  code:          string;
  qty:           string;
  unit:          string;
  lengthInches:  string | null;
  confirmNeeded: string;
  status:        string;
  foundBrand:      string | null;
  foundCollection: string | null;
  note:          string | null;
  verifiedAt:    Date | null;
  verifiedByName: string | null;
}

export interface PendingGroup {
  key:    string;
  label:  string;
  source: string;
  rows:   PendingRow[];
  done:   number;
}

export interface PendingQueue {
  groups:  PendingGroup[];
  total:   number;
  checked: number;
}

export async function getPendingQueue(ctx: RequestContext): Promise<PendingQueue> {
  requirePermission(ctx, "inventory.view");
  const db = scoped(ctx);

  const items = await db.pendingStockItem.findMany({
    orderBy: [{ groupKey: "asc" }, { code: "asc" }],
    select: {
      id: true, sourceId: true, groupKey: true, groupLabel: true, source: true,
      catalogueName: true, code: true, qty: true, unit: true, lengthInches: true,
      confirmNeeded: true, status: true, foundBrand: true, foundCollection: true,
      note: true, verifiedById: true, verifiedAt: true,
    },
  });

  // Resolve who checked each one, in a single round-trip. Store staff want
  // to know who to ask when a note is unclear.
  const userIds = [...new Set(items.map((i) => i.verifiedById).filter((v): v is string => !!v))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name] as const));

  const byGroup = new Map<string, PendingGroup>();
  for (const i of items) {
    let g = byGroup.get(i.groupKey);
    if (!g) {
      g = { key: i.groupKey, label: i.groupLabel, source: i.source, rows: [], done: 0 };
      byGroup.set(i.groupKey, g);
    }
    g.rows.push({
      id: i.id,
      catalogueName: i.catalogueName,
      code: i.code,
      // Trailing zeros on a roll count help nobody — "6" not "6.000".
      qty: String(Number(i.qty)),
      unit: i.unit,
      lengthInches: i.lengthInches ? String(Number(i.lengthInches)) : null,
      confirmNeeded: i.confirmNeeded,
      status: i.status,
      foundBrand: i.foundBrand,
      foundCollection: i.foundCollection,
      note: i.note,
      verifiedAt: i.verifiedAt,
      verifiedByName: i.verifiedById ? (nameById.get(i.verifiedById) ?? null) : null,
    });
    if (i.status !== "PENDING") g.done += 1;
  }

  const groups = [...byGroup.values()];
  return {
    groups,
    total:   items.length,
    checked: items.filter((i) => i.status !== "PENDING").length,
  };
}

/**
 * How many items are still unverified — for the Stocks tab badge.
 *
 * A count query rather than reusing getPendingQueue: the stock list page
 * renders the same tab strip and has no reason to load every row and
 * resolve every verifier's name just to print one number.
 */
export async function countPendingStock(ctx: RequestContext): Promise<number> {
  requirePermission(ctx, "inventory.view");
  return scoped(ctx).pendingStockItem.count({ where: { status: "PENDING" } });
}
