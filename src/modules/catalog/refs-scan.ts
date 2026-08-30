// Shared audit-trail safety scan used by both brand and collection
// destructive actions. Returns a human-readable list of transactional
// references (or null if the target is clean).
//
// If any records here reference a colourway we're about to delete, the
// deletion is refused — orphaning a quotation line's FK would silently
// break the audit trail.

import type { scoped } from "@/kernel/db/scoped";

export async function scanTransactionalRefs(
  db: ReturnType<typeof scoped>,
  colourwayIds: string[],
  collectionIds: string[],
): Promise<string | null> {
  if (colourwayIds.length === 0) return null;
  const inCw  = { colourwayId:  { in: colourwayIds  } };
  const inCol = { collectionId: { in: collectionIds } };
  const [quoteLines, orderLines, poLines, grnLines, stockMoves, allocations, sampleBooks] = await Promise.all([
    db.quotationLine.count({ where: inCw }),
    db.orderLine.count({ where: inCw }),
    db.pOLine.count({ where: inCw }),
    db.gRNLine.count({ where: inCw }),
    db.stockMove.count({ where: inCw }),
    db.allocation.count({ where: inCw }),
    db.sampleBook.count({ where: inCol }),
  ]);
  const parts: string[] = [];
  if (quoteLines)  parts.push(`${quoteLines} quotation line${quoteLines === 1 ? "" : "s"}`);
  if (orderLines)  parts.push(`${orderLines} order line${orderLines === 1 ? "" : "s"}`);
  if (poLines)     parts.push(`${poLines} PO line${poLines === 1 ? "" : "s"}`);
  if (grnLines)    parts.push(`${grnLines} GRN line${grnLines === 1 ? "" : "s"}`);
  if (stockMoves)  parts.push(`${stockMoves} stock move${stockMoves === 1 ? "" : "s"}`);
  if (allocations) parts.push(`${allocations} allocation${allocations === 1 ? "" : "s"}`);
  if (sampleBooks) parts.push(`${sampleBooks} sample book${sampleBooks === 1 ? "" : "s"}`);
  return parts.length === 0 ? null : parts.join(", ");
}
