// Which catalogues are on the shelf, and which are out.
//
// Backed by SampleBook + SampleIssue — the ledger /samples already used for
// barcoded supplier books. A catalogue-backed SampleBook is created lazily,
// the first time that catalogue is issued, so 694 rows do not need 694
// placeholder books to exist before anyone lends anything.
//
// A catalogue is OUT when its book has a SampleIssue with returnedAt NULL.
// No status column is trusted for that: status is a cache, the open issue
// is the fact.

import { scoped } from "@/kernel/db/scoped";
import type { RequestContext } from "@/kernel/auth/context";
import type { ProductFamily } from "@prisma/client";

export interface CatalogueShelfRow {
  id:       string;
  name:     string;
  family:   ProductFamily;
  /** Null when the catalogue is on the shelf. */
  loan: null | {
    issueId:     string;
    holderName:  string;
    holderType:  string;
    issuedAt:    Date;
    dueAt:       Date | null;
    /** Positive when past due. Null when no date was agreed. */
    daysOverdue: number | null;
  };
}

export interface ShelfCounts {
  total:   number;
  withMe:  number;
  out:     number;
  overdue: number;
}

/**
 * Every catalogue with its current loan, if any.
 *
 * Two queries, not a nested include: the catalogue list is the big table
 * and open loans are a handful, so fetching the loans separately and
 * stitching keeps this O(catalogues) rather than a join per row.
 */
export async function listShelf(ctx: RequestContext): Promise<CatalogueShelfRow[]> {
  const db = scoped(ctx);

  const [catalogues, openIssues] = await Promise.all([
    db.catalogue.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, family: true },
    }),
    db.sampleIssue.findMany({
      where:   { returnedAt: null, book: { catalogueId: { not: null } } },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true, issuedToType: true, holderName: true,
        clientId: true, architectId: true, userId: true,
        issuedAt: true, dueAt: true,
        book: { select: { catalogueId: true } },
      },
    }),
  ]);

  // Resolve display names for holders whose snapshot predates holderName.
  const clientIds = [...new Set(openIssues.map((i) => i.clientId).filter((v): v is string => !!v))];
  const archIds   = [...new Set(openIssues.map((i) => i.architectId).filter((v): v is string => !!v))];
  const userIds   = [...new Set(openIssues.map((i) => i.userId).filter((v): v is string => !!v))];

  const [clients, architects, users] = await Promise.all([
    clientIds.length ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }) : [],
    archIds.length   ? db.architect.findMany({ where: { id: { in: archIds } }, select: { id: true, contactName: true } }) : [],
    userIds.length   ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : [],
  ]);
  const nameOf = new Map<string, string>([
    ...clients.map((c) => [c.id, c.name] as const),
    ...architects.map((a) => [a.id, a.contactName] as const),
    ...users.map((u) => [u.id, u.name] as const),
  ]);

  const now = Date.now();
  const byCatalogue = new Map<string, CatalogueShelfRow["loan"]>();
  for (const i of openIssues) {
    const cid = i.book.catalogueId;
    if (!cid || byCatalogue.has(cid)) continue;
    const resolved =
      (i.clientId && nameOf.get(i.clientId)) ||
      (i.architectId && nameOf.get(i.architectId)) ||
      (i.userId && nameOf.get(i.userId)) ||
      i.holderName ||
      "Someone";
    let daysOverdue: number | null = null;
    if (i.dueAt) {
      const late = now - i.dueAt.getTime();
      if (late > 0) daysOverdue = Math.ceil(late / 86_400_000);
    }
    byCatalogue.set(cid, {
      issueId:    i.id,
      holderName: resolved,
      holderType: i.issuedToType,
      issuedAt:   i.issuedAt,
      dueAt:      i.dueAt,
      daysOverdue,
    });
  }

  return catalogues.map((c) => ({
    id:     c.id,
    name:   c.name,
    family: c.family,
    loan:   byCatalogue.get(c.id) ?? null,
  }));
}

export function countShelf(rows: readonly CatalogueShelfRow[]): ShelfCounts {
  let out = 0, overdue = 0;
  for (const r of rows) {
    if (!r.loan) continue;
    out++;
    if (r.loan.daysOverdue !== null) overdue++;
  }
  return { total: rows.length, withMe: rows.length - out, out, overdue };
}

/** Every loan of one catalogue, newest first — the card's history. */
export async function listCatalogueHistory(
  ctx: RequestContext,
  catalogueId: string,
) {
  const db = scoped(ctx);
  return db.sampleIssue.findMany({
    where:   { book: { catalogueId } },
    orderBy: { issuedAt: "desc" },
    take:    25,
    select: {
      id: true, holderName: true, issuedToType: true,
      issuedAt: true, dueAt: true, returnedAt: true, notes: true,
    },
  });
}
