// The pending-stock verification backlog.
//
// The 25 unmatched showroom items ship as a migration for real
// deployments; the seed re-inserts them because wipe() truncates every
// table, and a dev environment that opens /inventory/pending on an empty queue
// looks broken rather than finished.
//
// src/data/pending-stock.json stays the single origin for both paths, so
// the migration and the seed cannot disagree about what is on the list.

import type { PrismaClient } from "@prisma/client";
import pendingData from "../../src/data/pending-stock.json";

interface JsonItem {
  id: string;
  catalogueName: string | null;
  code: string;
  qty: number;
  unit: string;
  lengthInches?: number | null;
  confirmNeeded: string;
}
interface JsonSection {
  key: string; label: string; source: string; items: JsonItem[];
}

export async function seedPendingStock(db: PrismaClient, orgId: string): Promise<number> {
  const sections = pendingData.sections as JsonSection[];
  const rows = sections.flatMap((sec) =>
    sec.items.map((it) => ({
      organizationId: orgId,
      sourceId:       it.id,
      groupKey:       sec.key,
      groupLabel:     sec.label,
      source:         sec.source,
      catalogueName:  it.catalogueName,
      code:           it.code,
      qty:            String(it.qty),
      unit:           it.unit,
      lengthInches:   it.lengthInches != null ? String(it.lengthInches) : null,
      confirmNeeded:  it.confirmNeeded,
    })),
  );

  await db.pendingStockItem.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}
