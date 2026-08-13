// Server-side helpers for the §5.5 conflict review page.
//
// The conflicts themselves live in IndexedDB on the device. Given a
// batch of client-generated ids, this returns the server's current
// state so the client can render a side-by-side comparison and pick
// keep-server vs promote-local for each row.

import { scoped } from "@/kernel/db/scoped";
import { requirePermission } from "@/kernel/rbac/guard";
import type { RequestContext } from "@/kernel/auth/context";
import type { MeasurementStatusStr } from "./queries-types";

export interface ServerItemSnapshot {
  clientCuid:     string;
  exists:         boolean;
  roundStatus?:   MeasurementStatusStr;
  roundNumber?:   string;
  projectId?:     string;
  projectName?:   string;
  clientName?:    string;
  roomName?:      string | null;
  label?:         string;
  surface?:       string;
  family?:        string;
  widthMm?:       string;   // Decimal serialised — stringly compared client-side
  heightMm?:      string;
  quantity?:      number;
  headingType?:   string | null;
  fullness?:      string | null;
  layPattern?:    string | null;
  mountType?:     string | null;
}

export async function fetchServerItemsForConflict(
  ctx: RequestContext,
  ids: string[],
): Promise<ServerItemSnapshot[]> {
  requirePermission(ctx, "measurement.view");
  if (ids.length === 0) return [];
  const db = scoped(ctx);

  const items = await db.measurementItem.findMany({
    where:  { id: { in: ids } },
    select: {
      id: true, label: true, surface: true, family: true,
      widthMm: true, heightMm: true, quantity: true,
      headingType: true, fullness: true, layPattern: true, mountType: true,
      room: { select: { name: true } },
      measurement: {
        select: {
          number: true, status: true, projectId: true,
          project: {
            select: {
              name: true, client: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const found = new Map(items.map((it) => [it.id, it] as const));
  return ids.map((cuid) => {
    const it = found.get(cuid);
    if (!it) return { clientCuid: cuid, exists: false };
    return {
      clientCuid:   cuid,
      exists:       true,
      roundStatus:  it.measurement.status,
      roundNumber:  it.measurement.number,
      projectId:    it.measurement.projectId,
      projectName:  it.measurement.project.name,
      clientName:   it.measurement.project.client.name,
      roomName:     it.room.name,
      label:        it.label,
      surface:      it.surface,
      family:       it.family,
      widthMm:      it.widthMm.toString(),
      heightMm:     it.heightMm.toString(),
      quantity:     it.quantity,
      headingType:  it.headingType,
      fullness:     it.fullness?.toString() ?? null,
      layPattern:   it.layPattern,
      mountType:    it.mountType,
    };
  });
}
