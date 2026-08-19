"use server";

// Catalog lookups used by the measurement UI. Not part of the round or item
// lifecycle — split out so actions.ts stays under CLAUDE.md §10's 300-line
// ceiling and the round lifecycle reads as one thing.
//
// `"use server"` files may only export locally-defined async functions, so the
// ColourwayOption shape lives in actions-shared.ts and is re-imported by
// consumers from there.

import { scoped } from "@/kernel/db/scoped";
import { devContext } from "@/lib/dev-context";
import type { ColourwayOption } from "./actions-shared";

/** Active colourways for a product family, brand-then-colour ordered. Capped
 *  at 80 — this feeds a picker, not a report. */
export async function searchColourwaysByFamily(family: string): Promise<ColourwayOption[]> {
  const ctx = await devContext();
  const db  = scoped(ctx);
  const rows = await db.colourway.findMany({
    where: {
      isActive: true,
      design: { family: family as never, isActive: true },
    },
    orderBy: [{ design: { collection: { brand: { name: "asc" } } } }, { colourName: "asc" }],
    take: 80,
    select: {
      id: true,
      code: true,
      colourName: true,
      design: {
        select: {
          name: true,
          collection: { select: { brand: { select: { name: true } } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id:         r.id,
    code:       r.code,
    colourName: r.colourName,
    designName: r.design.name,
    brandName:  r.design.collection.brand.name,
  }));
}
