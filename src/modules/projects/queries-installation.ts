// What physically has to go into this house, and how much of it is done.
//
// Owner instruction 2026-08-27: "on the installation module, listing the
// works." Not a scheduling module — a checklist. The installer and the
// owner both want the same thing off this screen: which rooms are
// finished, which are not, and what is left in the ones that aren't.
//
// Grouped by room because that is how the work is actually done and how
// the client talks about it ("is the master bedroom finished?"). Room
// comes from the measurement item behind the order line; lines with no
// measurement (services, hardware, delivery) collect under one heading
// rather than being hidden.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";

const UNROOMED = "General / services";

export interface InstallLineRow {
  id:           string;
  description:  string;
  unit:         string;
  quantity:     string;
  installedQty: string;
  /** installedQty >= quantity — the line is finished. */
  done:         boolean;
}

export interface InstallRoomGroup {
  room:      string;
  lines:     InstallLineRow[];
  doneCount: number;
}

export interface ProjectInstallation {
  groups:     InstallRoomGroup[];
  totalLines: number;
  doneLines:  number;
  /** 0–100, by line count rather than value — this is a work checklist. */
  pct:        number;
  orderId:    string | null;
}

export async function getProjectInstallation(
  ctx:       RequestContext,
  projectId: string,
): Promise<ProjectInstallation> {
  requirePermission(ctx, "project.view");
  const db = scoped(ctx);

  const order = await db.order.findFirst({
    where:   { projectId, status: { not: "CANCELLED" } },
    orderBy: { date: "desc" },
    select:  { id: true },
  });
  if (!order) return { groups: [], totalLines: 0, doneLines: 0, pct: 0, orderId: null };

  const lines = await db.orderLine.findMany({
    where:   { orderId: order.id },
    orderBy: { lineNo: "asc" },
    select: {
      id: true, description: true, unit: true,
      quantity: true, installedQty: true, measurementItemId: true,
    },
  });
  if (lines.length === 0) {
    return { groups: [], totalLines: 0, doneLines: 0, pct: 0, orderId: order.id };
  }

  // Resolve room names in one round-trip rather than per line.
  const itemIds = lines
    .map((l) => l.measurementItemId)
    .filter((v): v is string => typeof v === "string");
  const items = itemIds.length
    ? await db.measurementItem.findMany({
        where:  { id: { in: itemIds } },
        select: { id: true, room: { select: { name: true, sortOrder: true } } },
      })
    : [];
  const roomByItem = new Map(items.map((i) => [i.id, i.room] as const));

  const byRoom = new Map<string, { sortOrder: number; lines: InstallLineRow[] }>();
  for (const l of lines) {
    const room = (l.measurementItemId ? roomByItem.get(l.measurementItemId) : null) ?? null;
    const key  = room?.name ?? UNROOMED;
    // Unroomed lines sort last, after every real room.
    const sortOrder = room?.sortOrder ?? Number.MAX_SAFE_INTEGER;

    const qty  = Number(l.quantity);
    const done = Number(l.installedQty);
    const row: InstallLineRow = {
      id:           l.id,
      description:  l.description,
      unit:         l.unit,
      quantity:     l.quantity.toString(),
      installedQty: l.installedQty.toString(),
      done:         qty > 0 && done >= qty,
    };

    const bucket = byRoom.get(key);
    if (bucket) bucket.lines.push(row);
    else byRoom.set(key, { sortOrder, lines: [row] });
  }

  const groups: InstallRoomGroup[] = [...byRoom.entries()]
    .sort((a, b) => a[1].sortOrder - b[1].sortOrder || a[0].localeCompare(b[0]))
    .map(([room, v]) => ({
      room,
      lines:     v.lines,
      doneCount: v.lines.filter((l) => l.done).length,
    }));

  const totalLines = lines.length;
  const doneLines  = groups.reduce((s, g) => s + g.doneCount, 0);

  return {
    groups,
    totalLines,
    doneLines,
    pct: totalLines === 0 ? 0 : Math.round((doneLines / totalLines) * 100),
    orderId: order.id,
  };
}
