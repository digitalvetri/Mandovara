// Measurement read-side. Feeds §5.1 (rounds list) and §5.2 (round detail).
//
// Superseded rounds are NOT hidden: the list groups them under their
// replacement so a user can always see the prior dimensions and who
// changed them (§5.1). A round chains via Measurement.supersedesId.
//
// Row shapes live in queries-types.ts so this file stays under
// CLAUDE.md §10's 300-line ceiling.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type {
  RoundListRow, RoundListGroup, RoundDetail, ItemDetail, RoomItemsBucket,
} from "./queries-types";

export type {
  RoundListRow, RoundListGroup, RoundDetail, ItemDetail, RoomItemsBucket,
  ItemCalcSnapshot, MeasurementStatusStr,
} from "./queries-types";

export async function listRoundsForProject(
  ctx:       RequestContext,
  projectId: string,
): Promise<RoundListGroup[]> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);

  const rounds = await db.measurement.findMany({
    where:   { projectId },
    orderBy: [{ revision: "desc" }, { visitedAt: "desc" }],
    select: {
      id: true, number: true, revision: true, visitedAt: true,
      status: true, notes: true, measuredById: true, supersedesId: true,
      items: { select: { id: true, room: { select: { name: true } } } },
    },
  });

  const measurerIds = new Set(rounds.map((r) => r.measuredById));
  const users = await db.user.findMany({
    where:  { id: { in: [...measurerIds] } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name] as const));

  const rows: RoundListRow[] = rounds.map((r) => ({
    id:             r.id,
    number:         r.number,
    revision:       r.revision,
    visitedAt:      r.visitedAt,
    status:         r.status,
    measuredById:   r.measuredById,
    measuredByName: nameOf.get(r.measuredById) ?? "—",
    approvedByName: null,
    itemCount:      r.items.length,
    roomsCovered: [...new Set(
      r.items.map((i) => i.room.name).sort((a, b) => a.localeCompare(b)),
    )],
    notes:          r.notes,
    supersedesId:   r.supersedesId,
  }));

  return groupBySupersedeChain(rows);
}

/** Collapse revisions into {head, history[]}. Head is the latest revision
 *  that no other row supersedes; history is the chain to older revisions,
 *  most recent first. Groups sorted by head visit date, newest first. */
function groupBySupersedeChain(rows: RoundListRow[]): RoundListGroup[] {
  const byId       = new Map(rows.map((r) => [r.id, r] as const));
  const supersedes = new Set(
    rows.map((r) => r.supersedesId).filter((id): id is string => typeof id === "string"),
  );

  const groups: RoundListGroup[] = [];
  for (const row of rows) {
    if (supersedes.has(row.id)) continue;
    const history: RoundListRow[] = [];
    let cursor: string | null = row.supersedesId;
    while (cursor) {
      const prior = byId.get(cursor);
      if (!prior) break;
      history.push(prior);
      cursor = prior.supersedesId;
    }
    groups.push({ head: row, history });
  }

  groups.sort((a, b) => b.head.visitedAt.getTime() - a.head.visitedAt.getTime());
  return groups;
}

export async function getRoundDetail(
  ctx:           RequestContext,
  measurementId: string,
): Promise<RoundDetail | null> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);

  const round = await db.measurement.findUnique({
    where: { id: measurementId },
    select: {
      id: true, number: true, revision: true, visitedAt: true,
      status: true, notes: true, measuredById: true,
      approvedById: true, approvedAt: true, supersedesId: true,
      project: {
        select: {
          id: true, name: true, number: true,
          client: { select: { name: true } },
        },
      },
      items: {
        orderBy: [{ room: { sortOrder: "asc" } }, { label: "asc" }],
        select: {
          id: true, roomId: true, label: true, surface: true, openingType: true,
          widthMm: true, heightMm: true, depthMm: true, quantity: true,
          deductions: true, family: true, headingType: true, fullness: true,
          layPattern: true, mountType: true, requiresPowerPoint: true,
          photoKeys: true, sketchKey: true, notes: true,
          room: { select: { id: true, name: true, floorLabel: true, sortOrder: true } },
          calc: {
            select: {
              engineVersion: true, materialQty: true, materialUnit: true,
              widthsRequired: true, cutLengthMm: true, rollsRequired: true,
              boxesRequired: true, areaSqft: true, warnings: true, computedAt: true,
              colourwayId: true,
            },
          },
        },
      },
    },
  });
  if (!round) return null;

  const userIds = [round.measuredById, round.approvedById]
    .filter((id): id is string => typeof id === "string");
  const users = userIds.length > 0
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name] as const));

  // CalcResult has a colourwayId FK but no Prisma relation to Colourway,
  // so hydrate the picked colourways in a batch and stitch on rendering.
  const pickedIds = Array.from(new Set(
    round.items
      .map((it) => it.calc?.colourwayId ?? null)
      .filter((v): v is string => typeof v === "string"),
  ));
  const colourways = pickedIds.length > 0
    ? await db.colourway.findMany({
        where:  { id: { in: pickedIds } },
        select: { id: true, code: true, colourName: true },
      })
    : [];
  const cwById = new Map(colourways.map((c) => [c.id, c] as const));

  const itemsByRoom = groupItemsByRoom(round.items, cwById);

  return {
    id:             round.id,
    number:         round.number,
    revision:       round.revision,
    visitedAt:      round.visitedAt,
    status:         round.status,
    notes:          round.notes,
    measuredById:   round.measuredById,
    measuredByName: nameOf.get(round.measuredById) ?? "—",
    approvedByName: round.approvedById ? (nameOf.get(round.approvedById) ?? "—") : null,
    approvedAt:     round.approvedAt,
    supersedesId:   round.supersedesId,
    project: {
      id:         round.project.id,
      name:       round.project.name,
      number:     round.project.number,
      clientName: round.project.client.name,
    },
    itemsByRoom,
  };
}

/** Bucket items under their Room, preserving Room.sortOrder. */
function groupItemsByRoom(
  items: Array<Parameters<typeof toItemDetail>[0]>,
  cwById: ReadonlyMap<string, { id: string; code: string; colourName: string }>,
): RoomItemsBucket[] {
  const byRoom = new Map<string, RoomItemsBucket>();
  for (const it of items) {
    const key = it.room.id;
    const bucket = byRoom.get(key) ?? {
      roomId:     it.room.id,
      roomName:   it.room.name,
      floorLabel: it.room.floorLabel,
      sortOrder:  it.room.sortOrder,
      items:      [],
    };
    bucket.items.push(toItemDetail(it, cwById));
    byRoom.set(key, bucket);
  }
  return [...byRoom.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

type ItemRow = {
  id: string; roomId: string; label: string; surface: string;
  openingType: string | null; widthMm: { toString: () => string };
  heightMm: { toString: () => string }; depthMm: { toString: () => string } | null;
  quantity: number; deductions: unknown; family: string;
  headingType: string | null; fullness: { toString: () => string } | null;
  layPattern: string | null; mountType: string | null; requiresPowerPoint: boolean;
  photoKeys: string[]; sketchKey: string | null; notes: string | null;
  room: { id: string; name: string; floorLabel: string | null; sortOrder: number };
  calc: {
    engineVersion: string; materialQty: { toString: () => string }; materialUnit: string;
    widthsRequired: number | null; cutLengthMm: { toString: () => string } | null;
    rollsRequired: number | null; boxesRequired: number | null;
    areaSqft: { toString: () => string } | null;
    warnings: string[]; computedAt: Date;
    colourwayId: string | null;
  } | null;
};

function toItemDetail(
  it: ItemRow,
  cwById: ReadonlyMap<string, { id: string; code: string; colourName: string }>,
): ItemDetail {
  const cw = it.calc?.colourwayId ? cwById.get(it.calc.colourwayId) ?? null : null;
  return {
    id:                 it.id,
    roomId:             it.roomId,
    roomName:           it.room.name,
    floorLabel:         it.room.floorLabel,
    label:              it.label,
    surface:            it.surface,
    openingType:        it.openingType,
    widthMm:            it.widthMm.toString(),
    heightMm:           it.heightMm.toString(),
    depthMm:            it.depthMm?.toString() ?? null,
    quantity:           it.quantity,
    deductions:         it.deductions,
    family:             it.family,
    headingType:        it.headingType,
    fullness:           it.fullness?.toString() ?? null,
    layPattern:         it.layPattern,
    mountType:          it.mountType,
    requiresPowerPoint: it.requiresPowerPoint,
    photoKeys:          it.photoKeys,
    sketchKey:          it.sketchKey,
    notes:              it.notes,
    calc: it.calc ? {
      engineVersion:  it.calc.engineVersion,
      materialQty:    it.calc.materialQty.toString(),
      materialUnit:   it.calc.materialUnit,
      widthsRequired: it.calc.widthsRequired,
      cutLengthMm:    it.calc.cutLengthMm?.toString() ?? null,
      rollsRequired:  it.calc.rollsRequired,
      boxesRequired:  it.calc.boxesRequired,
      areaSqft:       it.calc.areaSqft?.toString() ?? null,
      warnings:       it.calc.warnings,
      computedAt:     it.calc.computedAt,
      colourwayId:    it.calc.colourwayId,
      colourwayCode:  cw?.code       ?? null,
      colourName:     cw?.colourName ?? null,
    } : null,
  };
}

export async function listRoomsForProject(
  ctx:       RequestContext,
  projectId: string,
): Promise<{ id: string; name: string; floorLabel: string | null; sortOrder: number }[]> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);
  return db.room.findMany({
    where:   { projectId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select:  { id: true, name: true, floorLabel: true, sortOrder: true },
  });
}

/** Find the caller's most recent DRAFT round on this project — the
 *  field PWA uses this to resume rather than start a fresh round on
 *  every reload (§5.3 must survive tab close and reopen). */
export async function findResumableRound(
  ctx:       RequestContext,
  projectId: string,
): Promise<{ id: string; number: string; visitedAt: Date; itemCount: number } | null> {
  requirePermission(ctx, "measurement.view");
  const db = scoped(ctx);
  const round = await db.measurement.findFirst({
    where:   { projectId, status: "DRAFT", measuredById: ctx.userId },
    orderBy: { visitedAt: "desc" },
    select:  {
      id: true, number: true, visitedAt: true,
      items: { select: { id: true } },
    },
  });
  if (!round) return null;
  return { id: round.id, number: round.number, visitedAt: round.visitedAt, itemCount: round.items.length };
}
