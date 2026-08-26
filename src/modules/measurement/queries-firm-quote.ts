// Read-side for the "build a firm quote from measurements" flow. Owner's
// canonical flow (2026-08-25): after measurement is approved, the firm
// quote is built by picking a product per measured item. This query
// hydrates each APPROVED measurement item with its currently-attached
// colourway + a suggested retail rate so the builder can pre-populate.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

export interface FirmQuoteItem {
  measurementItemId: string;
  roundNumber:       string;      // e.g. "MDV/MEA-2608-0007-r1"
  roomName:          string;
  floorLabel:        string | null;
  label:             string;      // owner-visible "e.g. Curtain, Master BR"
  notes:             string | null;  // owner's free-text notes from measurement
  family:            string;
  materialQty:       string;      // Decimal.toString(), 3dp
  materialUnit:      string;      // SellUnit
  // Colourway currently attached via CalcResult.colourwayId — null when the
  // user hasn't picked yet.
  colourwayId:       string | null;
  colourwayCode:     string | null;
  colourName:        string | null;
  designCode:        string | null;
  designName:        string | null;
  brandName:         string | null;
  suggestedRatePaise: string;     // BigInt as string, "0" when no price
  gstRate:           number;      // from Design
  hsn:               string | null;
}

/**
 * Every APPROVED measurement item for the project, hydrated with the
 * currently-picked colourway (if any) and a suggested retail rate. The
 * quote builder uses these to prefill lines — one line per measurement.
 *
 * Draft/Submitted rounds are excluded. Superseded rounds are excluded (we
 * only surface the latest approved revision). Manual-only projects with
 * no measurements return an empty array — the builder shows an empty
 * state prompting the owner to take measurements first.
 */
export async function listItemsForFirmQuote(
  ctx:       RequestContext,
  projectId: string,
): Promise<FirmQuoteItem[]> {
  requirePermission(ctx, "quotation.create");
  const db = scoped(ctx);

  const rounds = await db.measurement.findMany({
    where: { projectId, status: "APPROVED" },
    select: {
      id: true, number: true, revision: true, supersedesId: true,
    },
  });
  if (rounds.length === 0) return [];

  // A round is "head" if no other round supersedes it.
  const supersededIds = new Set(
    rounds.map((r) => r.supersedesId).filter((v): v is string => typeof v === "string"),
  );
  const headRoundIds = rounds
    .filter((r) => !supersededIds.has(r.id))
    .map((r) => r.id);
  if (headRoundIds.length === 0) return [];

  const roundNumberById = new Map(
    rounds.map((r) => [r.id, r.revision > 0 ? `${r.number}-r${r.revision}` : r.number] as const),
  );

  const items = await db.measurementItem.findMany({
    where:   { measurementId: { in: headRoundIds } },
    orderBy: [{ room: { sortOrder: "asc" } }, { label: "asc" }],
    select: {
      id: true, label: true, notes: true, family: true, measurementId: true,
      room: { select: { name: true, floorLabel: true } },
      calc: {
        select: {
          materialQty: true, materialUnit: true, colourwayId: true,
        },
      },
    },
  });

  const pickedIds = Array.from(new Set(
    items.map((it) => it.calc?.colourwayId ?? null).filter((v): v is string => typeof v === "string"),
  ));
  const colourways = pickedIds.length > 0
    ? await db.colourway.findMany({
        where:  { id: { in: pickedIds } },
        select: {
          id: true, code: true, colourName: true,
          design: {
            select: {
              code: true, name: true, hsn: true, gstRate: true,
              collection: { select: { brand: { select: { name: true } } } },
            },
          },
          prices: {
            where: {
              tier: { in: ["RETAIL", "MRP"] },
              effectiveFrom: { lte: new Date() },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
            },
            orderBy: [{ tier: "asc" }, { effectiveFrom: "desc" }],
            take: 1,
            select: { amount: true },
          },
        },
      })
    : [];
  const cwById = new Map(colourways.map((c) => [c.id, c] as const));

  return items.map((it): FirmQuoteItem => {
    const cw = it.calc?.colourwayId ? cwById.get(it.calc.colourwayId) ?? null : null;
    return {
      measurementItemId: it.id,
      roundNumber:       roundNumberById.get(it.measurementId) ?? "—",
      roomName:          it.room.name,
      floorLabel:        it.room.floorLabel,
      label:             it.label,
      notes:             it.notes ?? null,
      family:            it.family,
      materialQty:       it.calc?.materialQty.toString() ?? "1.000",
      materialUnit:      it.calc?.materialUnit ?? "PIECE",
      colourwayId:       cw?.id ?? null,
      colourwayCode:     cw?.code ?? null,
      colourName:        cw?.colourName ?? null,
      designCode:        cw?.design.code ?? null,
      designName:        cw?.design.name ?? null,
      brandName:         cw?.design.collection.brand.name ?? null,
      suggestedRatePaise: (cw?.prices[0]?.amount ?? 0n).toString(),
      gstRate:           cw ? Number(cw.design.gstRate) : 18,
      hsn:               cw?.design.hsn ?? null,
    };
  });
}
