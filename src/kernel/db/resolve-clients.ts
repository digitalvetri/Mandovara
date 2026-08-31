// Resolve client display fields by id, instead of nesting them in a select.
//
// Why this exists rather than `project: { select: { client: {...} } }`:
//
// Project.client is a REQUIRED relation in the schema, so Prisma asserts a
// row comes back for it. Under scoped()/RLS that join can legitimately
// return nothing — a client in another organization, or one a row policy
// hides — and Prisma then fails the ENTIRE query:
//
//   Inconsistent query result: Field client is required to return data,
//   got `null` instead.
//
// One unreachable client and the whole page is a 500. That is a poor trade:
// the client's name is one cell, and losing it should cost that cell, not
// the list it sits in.
//
// Looking the clients up separately makes the absence representable. A
// caller that cannot see a client gets `undefined` from the map and prints
// a dash. Costs one extra query per list, which is the same shape the
// owner/user lookups in these modules already use.
//
// Run scripts/find-cross-org-clients.mjs to find rows that actually trigger
// this in a given database.

/** The subset of a Prisma client this helper needs — `scoped(ctx)` and
 *  `orgPrisma(orgId)` both satisfy it, and neither shares a named type. */
interface ClientReader {
  client: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true; mobile: true };
    }): Promise<{ id: string; name: string; mobile: string }[]>;
  };
}

export interface ResolvedClient {
  id: string;
  name: string;
  mobile: string;
}

/**
 * Look up the given client ids. Nulls and duplicates are fine; ids the
 * caller cannot see are simply absent from the result.
 *
 * Returns an empty map (no query) when there is nothing to look up.
 */
export async function resolveClients(
  db: ClientReader,
  ids: readonly (string | null | undefined)[],
): Promise<Map<string, ResolvedClient>> {
  const unique = [...new Set(ids.filter((id): id is string => id != null && id !== ""))];
  if (unique.length === 0) return new Map();

  const rows = await db.client.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, mobile: true },
  });
  return new Map(rows.map((c) => [c.id, c]));
}

/** Single-id convenience. Returns null when the client is unreachable. */
export async function resolveClient(
  db: ClientReader,
  id: string | null | undefined,
): Promise<ResolvedClient | null> {
  if (!id) return null;
  return (await resolveClients(db, [id])).get(id) ?? null;
}

/** The name to print when a client cannot be reached. */
export const UNKNOWN_CLIENT = "—";
